import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PAYROLL_READ_ROLES,
  PAYROLL_WRITE_ROLES,
} from '@/common/constants/roles.constant';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { toIsoString } from '@/common/utils/date.util';
import { calculateNetSalary } from '@/common/utils/payroll.util';
import { resolvePagination } from '@/common/utils/pagination.util';
import { FilterSalaryDto } from './dto/filter-salary.dto';
import {
  PayrollPeriodSummaryDto,
  SalaryResponseDto,
} from './dto/salary-response.dto';
import { UpdateSalaryDto } from './dto/update-salary.dto';
import { Salary, SalaryStatus } from './entities/salary.entity';
import { PayrollSettingsService } from './payroll-settings.service';
import { SalariesRepository } from './salaries.repository';

/**
 * Đọc, chỉnh tay và chốt bảng lương.
 *
 * QUYỀN Ở ĐÂY HẸP HƠN MỌI PHÂN HỆ KHÁC. `manager` đọc được hồ sơ và chấm công
 * của phòng mình nhưng KHÔNG đọc lương: biết lương nhân viên dưới quyền không
 * cần cho việc quản lý công việc, và một bảng lương lộ ra nội bộ là chuyện
 * không thu lại được. Vì thế module này không dùng `resolveScope` — không có
 * "phạm vi phòng ban" nào cả, chỉ có được đọc hay không.
 *
 * VÒNG ĐỜI MỘT DÒNG: `calculated` → `approved` → `paid`. Từ `approved` trở đi
 * là số đã chốt: không tính lại, không sửa tay. `cancelled` là đường thoát duy
 * nhất, và nó phải do người có quyền duyệt bấm.
 */
@Injectable()
export class SalariesService {
  private readonly logger = new Logger(SalariesService.name);

  constructor(
    private readonly salariesRepository: SalariesRepository,
    private readonly payrollSettingsService: PayrollSettingsService,
  ) {}

  async findAll(
    filter: FilterSalaryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<SalaryResponseDto>> {
    this.assertCanRead(user);

    const { page, limit, skip } = resolvePagination(filter);

    const [salaries, total] = await this.salariesRepository.findPaginated({
      skip,
      take: limit,
      sort: filter.sort ?? 'employeeCode',
      order: filter.order === 'desc' ? 'DESC' : 'ASC',
      year: filter.year,
      month: filter.month,
      employeeId: filter.employeeId,
      departmentId: filter.departmentId,
      status: filter.status,
    });

    return new PaginatedResponseDto(
      salaries.map((salary) => this.toResponse(salary)),
      total,
      page,
      limit,
    );
  }

  async summarise(
    year: number,
    month: number,
    user: AuthenticatedUser,
  ): Promise<PayrollPeriodSummaryDto> {
    this.assertCanRead(user);

    const totals = await this.salariesRepository.summarisePeriod(year, month);

    return { year, month, ...totals };
  }

  async findPeriods(
    user: AuthenticatedUser,
  ): Promise<{ year: number; month: number }[]> {
    this.assertCanRead(user);

    return this.salariesRepository.findPeriods();
  }

  async findOne(
    id: number,
    user: AuthenticatedUser,
  ): Promise<SalaryResponseDto> {
    this.assertCanRead(user);

    return this.toResponse(await this.getExistingOrThrow(id));
  }

  /**
   * Chỉnh tay thưởng / thu nhập khác / khấu trừ khác, rồi TÍNH LẠI thuế và net.
   *
   * Không tính lại thì sửa thưởng xong `net_salary` vẫn là con số cũ, và bảng
   * lương tự mâu thuẫn với chính các dòng của nó.
   */
  async update(
    id: number,
    dto: UpdateSalaryDto,
    user: AuthenticatedUser,
  ): Promise<SalaryResponseDto> {
    this.assertCanWrite(user);

    const salary = await this.getExistingOrThrow(id);

    this.assertNotLocked(salary);

    if (dto.performanceBonus !== undefined) {
      salary.performanceBonus = dto.performanceBonus.toFixed(2);
    }

    if (dto.otherIncome !== undefined) {
      salary.otherIncome = dto.otherIncome.toFixed(2);
    }

    if (dto.otherDeductions !== undefined) {
      salary.otherDeductions = dto.otherDeductions.toFixed(2);
    }

    if (dto.note !== undefined) {
      salary.note = dto.note.trim() || null;
    }

    await this.recalculate(salary);
    await this.salariesRepository.save(salary);

    this.logger.log(`Salary ${id} adjusted by user ${user.userId}`);

    return this.toResponse(await this.getExistingOrThrow(id));
  }

  async approve(
    id: number,
    user: AuthenticatedUser,
  ): Promise<SalaryResponseDto> {
    this.assertCanWrite(user);

    const salary = await this.getExistingOrThrow(id);

    if (salary.status !== SalaryStatus.CALCULATED) {
      throw new ConflictException({
        code: 'SALARY_NOT_CALCULATED',
        message: `Salary ${id} is "${salary.status}"; only a calculated payslip can be approved`,
      });
    }

    salary.status = SalaryStatus.APPROVED;
    salary.approvedBy = user.userId;
    salary.approvedAt = new Date();

    await this.salariesRepository.save(salary);

    this.logger.log(`Salary ${id} approved by user ${user.userId}`);

    return this.toResponse(await this.getExistingOrThrow(id));
  }

  /**
   * Đánh dấu ĐÃ TRẢ. Chỉ đi được từ `approved`.
   *
   * Nhảy thẳng từ `calculated` sang `paid` là bỏ mất bước duyệt — bước kiểm soát
   * cuối cùng trước khi tiền rời khỏi công ty.
   */
  async markPaid(
    id: number,
    user: AuthenticatedUser,
  ): Promise<SalaryResponseDto> {
    this.assertCanWrite(user);

    const salary = await this.getExistingOrThrow(id);

    if (salary.status !== SalaryStatus.APPROVED) {
      throw new ConflictException({
        code: 'SALARY_NOT_APPROVED',
        message: `Salary ${id} is "${salary.status}"; only an approved payslip can be marked as paid`,
      });
    }

    salary.status = SalaryStatus.PAID;
    salary.paidAt = new Date();

    await this.salariesRepository.save(salary);

    this.logger.log(`Salary ${id} marked as paid by user ${user.userId}`);

    return this.toResponse(await this.getExistingOrThrow(id));
  }

  /**
   * Huỷ một dòng đã chốt — đường thoát duy nhất khi phát hiện sai sau khi duyệt.
   *
   * Dòng `cancelled` vẫn nằm lại trong bảng làm vết, và lần tính lương sau sẽ
   * KHÔNG ghi đè nó (nó không còn ở trạng thái tính lại được). Muốn có số mới
   * thì huỷ rồi tính lại — hai bước tách bạch, mỗi bước có người bấm.
   */
  async cancel(
    id: number,
    user: AuthenticatedUser,
  ): Promise<SalaryResponseDto> {
    this.assertCanWrite(user);

    const salary = await this.getExistingOrThrow(id);

    if (salary.status === SalaryStatus.CANCELLED) {
      throw new ConflictException({
        code: 'SALARY_ALREADY_CANCELLED',
        message: `Salary ${id} is already cancelled`,
      });
    }

    salary.status = SalaryStatus.CANCELLED;

    await this.salariesRepository.save(salary);

    this.logger.warn(`Salary ${id} cancelled by user ${user.userId}`);

    return this.toResponse(await this.getExistingOrThrow(id));
  }

  // --------------------------------------------------------- nội bộ ----

  /** Tính lại thuế và net sau khi các khoản chỉnh tay thay đổi. */
  private async recalculate(salary: Salary): Promise<void> {
    const settings = await this.payrollSettingsService.getSettings();

    const result = calculateNetSalary({
      year: salary.year,
      month: salary.month,
      baseSalary: Number(salary.baseSalary),
      positionAllowance: Number(salary.positionAllowance),
      attendanceAllowance: Number(salary.attendanceAllowance),
      mealAllowance: Number(salary.mealAllowance),
      transportAllowance: Number(salary.transportAllowance),
      phoneAllowance: Number(salary.phoneAllowance),
      otherAllowances: Number(salary.otherAllowances),
      overtimePay: Number(salary.overtimePay),
      performanceBonus: Number(salary.performanceBonus),
      otherIncome: Number(salary.otherIncome),
      // Lương đóng bảo hiểm KHÔNG đổi theo thưởng: nó là con số ghi trong hợp
      // đồng, và bảng lương đã lưu lại kết quả sau khi áp trần.
      insuranceSalary: Number(salary.insuranceBaseSalary),
      region: settings.minimumWageRegion,
      dependentCount: salary.dependentCount,
      advanceDeduction: Number(salary.advanceDeduction),
      otherDeductions: Number(salary.otherDeductions),
    });

    salary.grossSalary = result.grossSalary.toFixed(2);
    salary.taxableIncome = result.taxableIncome.toFixed(2);
    salary.personalIncomeTax = result.personalIncomeTax.toFixed(2);
    salary.netSalary = result.netSalary.toFixed(2);
  }

  private assertCanRead(user: AuthenticatedUser): void {
    if (!PAYROLL_READ_ROLES.includes(user.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Role "${user.role}" cannot read payroll; requires one of roles: ${PAYROLL_READ_ROLES.join(', ')}`,
      });
    }
  }

  private assertCanWrite(user: AuthenticatedUser): void {
    if (!PAYROLL_WRITE_ROLES.includes(user.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Role "${user.role}" cannot change payroll; requires one of roles: ${PAYROLL_WRITE_ROLES.join(', ')}`,
      });
    }
  }

  private assertNotLocked(salary: Salary): void {
    if (
      salary.status === SalaryStatus.APPROVED ||
      salary.status === SalaryStatus.PAID
    ) {
      throw new ConflictException({
        code: 'SALARY_LOCKED',
        message: `Salary ${salary.id} is "${salary.status}" and can no longer be changed; cancel it first`,
      });
    }
  }

  private async getExistingOrThrow(id: number): Promise<Salary> {
    const salary = await this.salariesRepository.findById(id);

    if (!salary) {
      throw new NotFoundException({
        code: 'SALARY_NOT_FOUND',
        message: `Salary ${id} not found`,
      });
    }

    return salary;
  }

  /** `DECIMAL` của TypeORM về dưới dạng chuỗi — đổi sang số ngay ở biên. */
  private toResponse(salary: Salary): SalaryResponseDto {
    return {
      id: Number(salary.id),
      employeeId: Number(salary.employeeId),
      employee: {
        id: Number(salary.employee?.id ?? salary.employeeId),
        employeeCode: salary.employee?.employeeCode ?? '',
        fullName: salary.employee?.fullName ?? '',
        departmentName: salary.employee?.department?.name ?? null,
        positionName: salary.employee?.position?.name ?? null,
      },
      month: salary.month,
      year: salary.year,
      standardWorkingDays: Number(salary.standardWorkingDays),
      actualWorkingDays: Number(salary.actualWorkingDays),
      paidLeaveDays: Number(salary.paidLeaveDays),
      unpaidLeaveDays: Number(salary.unpaidLeaveDays),
      overtimeHours: Number(salary.overtimeHours),
      baseSalary: Number(salary.baseSalary),
      positionAllowance: Number(salary.positionAllowance),
      attendanceAllowance: Number(salary.attendanceAllowance),
      mealAllowance: Number(salary.mealAllowance),
      transportAllowance: Number(salary.transportAllowance),
      phoneAllowance: Number(salary.phoneAllowance),
      otherAllowances: Number(salary.otherAllowances),
      overtimePay: Number(salary.overtimePay),
      performanceBonus: Number(salary.performanceBonus),
      otherIncome: Number(salary.otherIncome),
      grossSalary: Number(salary.grossSalary),
      insuranceBaseSalary: Number(salary.insuranceBaseSalary),
      socialInsurance: Number(salary.socialInsurance),
      healthInsurance: Number(salary.healthInsurance),
      unemploymentInsurance: Number(salary.unemploymentInsurance),
      totalInsurance: Number(salary.totalInsurance),
      dependentCount: salary.dependentCount,
      selfDeduction: Number(salary.selfDeduction),
      dependentDeduction: Number(salary.dependentDeduction),
      taxableIncome: Number(salary.taxableIncome),
      personalIncomeTax: Number(salary.personalIncomeTax),
      advanceDeduction: Number(salary.advanceDeduction),
      otherDeductions: Number(salary.otherDeductions),
      netSalary: Number(salary.netSalary),
      status: salary.status,
      note: salary.note,
      approvedAt: salary.approvedAt ? toIsoString(salary.approvedAt) : null,
      paidAt: salary.paidAt ? toIsoString(salary.paidAt) : null,
    };
  }
}
