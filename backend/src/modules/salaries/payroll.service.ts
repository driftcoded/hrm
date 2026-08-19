import {
  ForbiddenException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PAYROLL_WRITE_ROLES } from '@/common/constants/roles.constant';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { toDateOnlyString } from '@/common/utils/date.util';
import {
  calculateNetSalary,
  hourlyRate,
  prorateByWorkedDays,
  roundVnd,
  standardWorkingDaysInMonth,
} from '@/common/utils/payroll.util';
import { summariseAttendanceForPayroll } from '@/common/utils/payroll-attendance.util';
import { Contract } from '@/modules/contracts/entities/contract.entity';
import { Employee } from '@/modules/employees/entities/employee.entity';
import { LeaveRequestsRepository } from '@/modules/leave-requests/leave-requests.repository';
import { HolidaysService } from '@/modules/system/holidays.service';
import { PayrollSettings } from './entities/payroll-settings.entity';
import { SalaryAdvance } from './entities/salary-advance.entity';
import { Salary, SalaryStatus } from './entities/salary.entity';
import { PayrollRepository } from './payroll.repository';
import { PayrollSettingsService } from './payroll-settings.service';

/**
 * Bảng lương ĐÃ CHỐT thì không tính lại (PLAN 6.1).
 *
 * `approved` là số đã được duyệt chi, `paid` là tiền đã ra khỏi tài khoản. Tính
 * lại một dòng như thế sẽ làm bảng lương nói khác với thứ đã trả — muốn sửa thì
 * phải huỷ dòng đó ra `cancelled` một cách tường minh.
 */
/** Một phiếu tạm ứng và phần vừa thu hồi được ở kỳ này. */
interface AdvanceRecovery {
  advance: SalaryAdvance;
  deducted: number;
}

const LOCKED_STATUSES = new Set<SalaryStatus>([
  SalaryStatus.APPROVED,
  SalaryStatus.PAID,
]);

export interface PayrollRunSummary {
  year: number;
  month: number;
  standardWorkingDays: number;
  employeesConsidered: number;
  created: number;
  updated: number;
  /** Dòng đã chốt nên không tính lại. */
  skippedLocked: number;
  /** Nhân viên không có hợp đồng còn hiệu lực trong kỳ — không có căn cứ trả. */
  skippedNoContract: string[];
  totalGross: number;
  totalNet: number;
  dryRun: boolean;
}

/**
 * Tính lương hàng loạt cho một kỳ (business-rules.md §6).
 *
 * MỘT LẦN CHẠY LÀ MỘT THÁNG, không phải một người. Lương phụ thuộc vào số ngày
 * công CHUẨN của tháng, và con số đó chung cho cả công ty — tính lẻ từng người
 * sẽ mở đường cho hai người cùng tháng nhưng khác mẫu số.
 *
 * CHẠY LẠI ĐƯỢC BAO NHIÊU LẦN CŨNG ĐƯỢC, chừng nào bảng lương chưa chốt: dòng
 * `draft`/`calculated` bị ghi đè bằng số mới, dòng `approved`/`paid` được giữ
 * nguyên và báo ra ở `skippedLocked`. Chấm công nhập bổ sung sau khi đã tính là
 * chuyện thường ngày, nên "tính một lần rồi thôi" sẽ luôn cho ra bảng lương cũ.
 */
@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    private readonly payrollRepository: PayrollRepository,
    private readonly payrollSettingsService: PayrollSettingsService,
    private readonly leaveRequestsRepository: LeaveRequestsRepository,
    private readonly holidaysService: HolidaysService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Điểm vào của `POST /salaries/calculate` — kiểm tra quyền rồi chạy.
   *
   * Tính lương là thao tác GHI cấp công ty, nên nó đứng cùng hàng rào với duyệt
   * lương (`PAYROLL_WRITE_ROLES`) chứ không phải với quyền đọc.
   */
  async calculate(
    dto: { year: number; month: number; dryRun?: boolean },
    user: AuthenticatedUser,
  ): Promise<PayrollRunSummary> {
    if (!PAYROLL_WRITE_ROLES.includes(user.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Role "${user.role}" cannot run payroll; requires one of roles: ${PAYROLL_WRITE_ROLES.join(', ')}`,
      });
    }

    return this.run(dto.year, dto.month, user.userId, dto.dryRun ?? false);
  }

  async run(
    year: number,
    month: number,
    generatedBy: number | null,
    dryRun: boolean,
  ): Promise<PayrollRunSummary> {
    const settings = await this.payrollSettingsService.getSettings();

    /*
     * `Date.UTC(year, month, 0)` là ngày CUỐI của `month` — tháng ở đây đã +1 vì
     * `Date` đếm tháng từ 0, và ngày 0 lùi về ngày cuối tháng trước. Viết
     * `${year}-${month}-31` sẽ hỏng ở tháng 2 và MySQL im lặng trả về rỗng.
     */
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const paddedMonth = String(month).padStart(2, '0');
    const periodStart = `${year}-${paddedMonth}-01`;
    const periodEnd = `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`;

    const holidays = await this.holidayDatesIn(year);
    const standardWorkingDays = standardWorkingDaysInMonth(
      year,
      month,
      holidays,
    );

    if (standardWorkingDays <= 0) {
      throw new UnprocessableEntityException({
        code: 'PAYROLL_NO_WORKING_DAYS',
        message: `${year}-${month} has no standard working day; the daily rate would divide by zero`,
      });
    }

    const employees = await this.payrollRepository.findPayableEmployees();
    const employeeIds = employees.map((employee) => Number(employee.id));

    const [contracts, attendance, dependents, advances, existing] =
      await Promise.all([
        this.payrollRepository.findActiveContracts(
          employeeIds,
          periodStart,
          periodEnd,
        ),
        this.payrollRepository.findAttendanceInPeriod(
          employeeIds,
          periodStart,
          periodEnd,
        ),
        this.payrollRepository.countActiveDependents(employeeIds, periodEnd),
        this.payrollRepository.findAdvancesForPeriod(year, month),
        this.payrollRepository.findSalariesForPeriod(year, month),
      ]);

    const paidLeaveDays = await this.paidLeaveDaysIn(
      periodStart,
      periodEnd,
      holidays,
    );
    const existingByEmployee = new Map(
      existing.map((salary) => [Number(salary.employeeId), salary]),
    );

    const summary: PayrollRunSummary = {
      year,
      month,
      standardWorkingDays,
      employeesConsidered: employees.length,
      created: 0,
      updated: 0,
      skippedLocked: 0,
      skippedNoContract: [],
      totalGross: 0,
      totalNet: 0,
      dryRun,
    };

    const drafts: Salary[] = [];
    const advanceRecoveries: AdvanceRecovery[] = [];

    for (const employee of employees) {
      const employeeId = Number(employee.id);
      const contract = contracts.get(employeeId);

      if (!contract) {
        summary.skippedNoContract.push(employee.employeeCode);
        continue;
      }

      const current = existingByEmployee.get(employeeId);

      if (current && LOCKED_STATUSES.has(current.status)) {
        summary.skippedLocked += 1;
        continue;
      }

      const { salary: draft, recoveries } = this.buildSalary({
        employee,
        contract,
        settings,
        year,
        month,
        standardWorkingDays,
        holidays,
        attendanceRows: attendance.get(employeeId) ?? [],
        paidLeaveDays: paidLeaveDays.get(employeeId) ?? 0,
        dependentCount: dependents.get(employeeId) ?? 0,
        advances: advances.get(employeeId) ?? [],
        existing: current,
        generatedBy,
      });

      summary.totalGross += Number(draft.grossSalary);
      summary.totalNet += Number(draft.netSalary);
      advanceRecoveries.push(...recoveries);

      if (current) {
        summary.updated += 1;
      } else {
        summary.created += 1;
      }

      drafts.push(draft);
    }

    if (dryRun) {
      return summary;
    }

    /*
     * Ghi cả kỳ trong MỘT transaction. Nửa chừng gãy mà vẫn giữ phần đã ghi sẽ
     * để lại một bảng lương một nửa cũ một nửa mới, và không ai nhìn ra được
     * đường ranh đó nằm ở đâu.
     */
    await this.dataSource.transaction(async (manager) => {
      await manager.save(Salary, drafts);
      await this.payrollRepository.recordAdvanceRecovery(
        manager,
        advanceRecoveries,
      );
    });

    this.logger.log(
      `Payroll ${year}-${month}: ${summary.created} created, ${summary.updated} updated, ${summary.skippedLocked} locked, ${summary.skippedNoContract.length} without a contract`,
    );

    return summary;
  }

  /**
   * Dựng một dòng bảng lương từ hợp đồng + chấm công + cấu hình.
   *
   * LƯƠNG THEO NGÀY CÔNG, không phải lương tháng cố định: lương cơ bản và phụ
   * cấp chức vụ được chia theo `actualWorkingDays + paidLeaveDays` trên ngày
   * công chuẩn (§2.3). Trả nguyên lương tháng cho người nghỉ không lương nửa
   * tháng là trả cho những ngày không có ai đi làm.
   *
   * Phụ cấp cơm/xe/điện thoại KHÔNG chia theo ngày công — đó là khoản bù chi phí
   * theo chính sách, không phải tiền công. Riêng phụ cấp chuyên cần thì mất
   * trắng nếu có ngày nghỉ không lương, đúng nghĩa "chuyên cần".
   */
  private buildSalary(input: {
    employee: Employee;
    contract: Contract;
    settings: PayrollSettings;
    year: number;
    month: number;
    standardWorkingDays: number;
    holidays: Set<string>;
    attendanceRows: {
      workDate: string;
      status: string;
      checkIn: string | null;
      checkOut: string | null;
      overtimeHours: string | null;
    }[];
    paidLeaveDays: number;
    dependentCount: number;
    /** Phiếu tạm ứng khai trừ vào kỳ này, đã sắp theo thứ tự ứng. */
    advances: SalaryAdvance[];
    existing?: Salary;
    generatedBy: number | null;
  }): { salary: Salary; recoveries: AdvanceRecovery[] } {
    const monthlySalary = Number(input.contract.baseSalary);
    const positionAllowance = Number(input.contract.positionAllowance);

    const perHour = hourlyRate(
      monthlySalary,
      input.standardWorkingDays,
      Number(input.contract.workingHours) || 8,
    );

    const attendance = summariseAttendanceForPayroll({
      rows: input.attendanceRows.map((row) => ({
        workDate: toDateOnlyString(row.workDate),
        status: row.status,
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        overtimeHours: Number(row.overtimeHours ?? 0),
      })),
      holidays: input.holidays,
      hourlyRate: perHour,
    });

    const paidDays = attendance.actualWorkingDays + input.paidLeaveDays;
    const unpaidLeaveDays = Math.max(0, input.standardWorkingDays - paidDays);

    const baseSalary = prorateByWorkedDays(
      monthlySalary,
      input.standardWorkingDays,
      paidDays,
    );
    const proratedPositionAllowance = prorateByWorkedDays(
      positionAllowance,
      input.standardWorkingDays,
      paidDays,
    );

    // Chuyên cần: có ngày nghỉ không lương thì mất cả khoản, không chia tỉ lệ.
    const attendanceAllowance =
      unpaidLeaveDays > 0 ? 0 : Number(input.settings.attendanceAllowance);

    /*
     * TIỀN ĂN CA TÍNH THEO NGÀY CÓ MẶT, không phải một khoản cố định hàng tháng.
     * Nó là tiền bữa trưa của những ngày thực sự đi làm — trả trọn tháng cho
     * người nghỉ nửa tháng là trả tiền cơm cho những bữa không ai ăn. Xe cộ và
     * điện thoại thì ngược lại: đó là khoản bù chi phí cố định theo tháng.
     */
    const mealAllowance = prorateByWorkedDays(
      Number(input.settings.mealAllowance),
      input.standardWorkingDays,
      attendance.actualWorkingDays,
    );

    const overtimePay = input.settings.payOvertime ? attendance.overtimePay : 0;

    /*
     * KHOẢN CHỈNH TAY PHẢI ĐI VÀO PHÉP TÍNH, không chỉ nằm lại trong cột của nó.
     * Thưởng, thu nhập khác và khấu trừ khác không suy ra được từ dữ liệu gốc
     * nên được giữ qua mỗi lần tính lại — nhưng giữ mà không cộng vào thì gross
     * hụt đúng bằng khoản thưởng, và thuế lẫn thực nhận sai theo.
     */
    const performanceBonus = Number(input.existing?.performanceBonus ?? 0);
    const otherIncome = Number(input.existing?.otherIncome ?? 0);
    const otherDeductions = Number(input.existing?.otherDeductions ?? 0);

    /*
     * Tính TRƯỚC khi trừ tạm ứng: tạm ứng là khoản trừ sau thuế, nên phần lương
     * còn lại sau bảo hiểm và thuế chính là trần thu hồi được của kỳ này.
     */
    const calculation = calculateNetSalary({
      year: input.year,
      month: input.month,
      baseSalary,
      positionAllowance: proratedPositionAllowance,
      attendanceAllowance,
      mealAllowance,
      transportAllowance: Number(input.settings.transportAllowance),
      phoneAllowance: Number(input.settings.phoneAllowance),
      otherAllowances: Number(input.contract.otherAllowance),
      overtimePay,
      performanceBonus,
      otherIncome,
      insuranceSalary: Number(input.contract.insuranceSalary),
      region: input.settings.minimumWageRegion,
      dependentCount: input.dependentCount,
      unpaidWorkingDays: unpaidLeaveDays,
      otherDeductions,
    });

    /*
     * KHÔNG TRỪ QUÁ PHẦN LƯƠNG CÒN LẠI. Một bảng lương ra số âm nghĩa là công ty
     * đang đòi tiền nhân viên trên chính tờ phiếu lương của họ. Phần chưa thu
     * được nằm lại ở `deducted_amount` và phiếu vẫn ở trạng thái `approved` để
     * kế toán nhìn thấy; muốn thu tiếp thì chuyển kỳ trừ của phiếu sang tháng
     * sau.
     */
    const { deducted: advanceDeduction, recoveries } = this.allocateAdvances(
      input.advances,
      Math.max(0, calculation.netSalary),
    );

    const netSalary = calculation.netSalary - advanceDeduction;

    const salary = input.existing ?? new Salary();

    salary.employeeId = Number(input.employee.id);
    salary.month = input.month;
    salary.year = input.year;

    salary.standardWorkingDays = input.standardWorkingDays.toFixed(1);
    salary.actualWorkingDays = attendance.actualWorkingDays.toFixed(1);
    salary.paidLeaveDays = input.paidLeaveDays.toFixed(1);
    salary.unpaidLeaveDays = unpaidLeaveDays.toFixed(1);
    salary.overtimeHours = attendance.overtimeHours.toFixed(1);

    salary.baseSalary = baseSalary.toFixed(2);
    salary.positionAllowance = proratedPositionAllowance.toFixed(2);
    salary.attendanceAllowance = attendanceAllowance.toFixed(2);
    salary.mealAllowance = mealAllowance.toFixed(2);
    salary.transportAllowance = Number(
      input.settings.transportAllowance,
    ).toFixed(2);
    salary.phoneAllowance = Number(input.settings.phoneAllowance).toFixed(2);
    salary.otherAllowances = Number(input.contract.otherAllowance).toFixed(2);
    salary.overtimePay = roundVnd(overtimePay).toFixed(2);
    salary.performanceBonus = performanceBonus.toFixed(2);
    salary.otherIncome = otherIncome.toFixed(2);
    salary.grossSalary = calculation.grossSalary.toFixed(2);

    salary.insuranceBaseSalary = calculation.insuranceBaseSalary.toFixed(2);
    salary.socialInsurance = calculation.socialInsurance.toFixed(2);
    salary.healthInsurance = calculation.healthInsurance.toFixed(2);
    salary.unemploymentInsurance = calculation.unemploymentInsurance.toFixed(2);
    salary.totalInsurance = calculation.totalInsurance.toFixed(2);

    salary.dependentCount = input.dependentCount;
    salary.selfDeduction = calculation.selfDeduction.toFixed(2);
    salary.dependentDeduction = calculation.dependentDeduction.toFixed(2);
    salary.taxableIncome = calculation.taxableIncome.toFixed(2);
    salary.personalIncomeTax = calculation.personalIncomeTax.toFixed(2);

    salary.advanceDeduction = advanceDeduction.toFixed(2);
    salary.otherDeductions = otherDeductions.toFixed(2);
    salary.netSalary = netSalary.toFixed(2);

    salary.status = SalaryStatus.CALCULATED;
    salary.generatedBy = input.generatedBy;

    return { salary, recoveries };
  }

  /**
   * Chia phần lương còn lại cho các phiếu tạm ứng, theo thứ tự ứng trước trả
   * trước.
   *
   * Ứng trước trả trước chứ không chia đều: một khoản ứng cũ để lửng lơ qua
   * nhiều kỳ là thứ không ai theo dõi nổi, còn thứ tự thời gian thì kế toán đối
   * chiếu được với chứng từ chi.
   */
  private allocateAdvances(
    advances: SalaryAdvance[],
    available: number,
  ): { deducted: number; recoveries: AdvanceRecovery[] } {
    let remaining = available;
    let deducted = 0;
    const recoveries: AdvanceRecovery[] = [];

    /*
     * Mọi phiếu của kỳ đều được ghi lại, KỂ CẢ phiếu không thu được đồng nào:
     * đây là lần dựng lại con số từ đầu, nên phiếu bị bỏ sót sẽ giữ nguyên con
     * số của lần chạy trước và nói sai.
     */
    for (const advance of advances) {
      const take = Math.max(0, Math.min(Number(advance.amount), remaining));

      recoveries.push({ advance, deducted: roundVnd(take) });
      deducted += roundVnd(take);
      remaining -= take;
    }

    return { deducted, recoveries };
  }

  /**
   * Số ngày phép CÓ LƯƠNG của từng nhân viên rơi vào kỳ.
   *
   * Đếm lại từ đơn nghỉ ĐÃ DUYỆT chứ không đọc bảng chấm công: bảng chấm công
   * chỉ ghi `status = leave`, không nói loại phép nào — mà "có lương hay không"
   * nằm ở `leave_types.is_paid`. Nghỉ không lương và nghỉ phép năm trông giống
   * hệt nhau trên bảng công.
   *
   * Chỉ đếm ngày TRONG kỳ: một kỳ nghỉ bắc qua đầu tháng không được tính trọn
   * vào tháng này.
   */
  private async paidLeaveDaysIn(
    periodStart: string,
    periodEnd: string,
    holidays: Set<string>,
  ): Promise<Map<number, number>> {
    const requests = await this.leaveRequestsRepository.findApprovedInRange(
      periodStart,
      periodEnd,
    );

    const byEmployee = new Map<number, number>();

    for (const request of requests) {
      if (!request.leaveType?.isPaid) {
        continue;
      }

      const start = toDateOnlyString(request.startDate);
      const end = toDateOnlyString(request.endDate);
      const from = start < periodStart ? periodStart : start;
      const to = end > periodEnd ? periodEnd : end;

      let days = 0;

      for (
        let cursor = new Date(`${from}T00:00:00Z`);
        cursor.toISOString().slice(0, 10) <= to;
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      ) {
        const iso = cursor.toISOString().slice(0, 10);
        const weekday = cursor.getUTCDay();

        if (weekday !== 0 && weekday !== 6 && !holidays.has(iso)) {
          days += 1;
        }
      }

      const key = Number(request.employeeId);

      byEmployee.set(key, (byEmployee.get(key) ?? 0) + days);
    }

    return byEmployee;
  }

  private async holidayDatesIn(year: number): Promise<Set<string>> {
    const holidays = await this.holidaysService.findByYear(year);

    return new Set(holidays.map((holiday) => holiday.holidayDate));
  }
}
