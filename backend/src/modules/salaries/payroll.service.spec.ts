import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { Attendance } from '@/modules/attendances/entities/attendance.entity';
import { Contract } from '@/modules/contracts/entities/contract.entity';
import { Employee } from '@/modules/employees/entities/employee.entity';
import { LeaveRequestsRepository } from '@/modules/leave-requests/leave-requests.repository';
import { HolidaysService } from '@/modules/system/holidays.service';
import { PayrollSettings } from './entities/payroll-settings.entity';
import { SalaryAdvance } from './entities/salary-advance.entity';
import { Salary, SalaryStatus } from './entities/salary.entity';
import { PayrollRepository } from './payroll.repository';
import { PayrollService } from './payroll.service';
import { PayrollSettingsService } from './payroll-settings.service';

/*
 * Kỳ lương dùng chung: tháng 8/2026 có 21 ngày công chuẩn (1/8 là thứ Bảy),
 * không có ngày lễ. Lương hợp đồng 21.000.000 ⇒ đúng 1.000.000 đ/ngày, để mọi
 * con số trong bài test đọc được bằng mắt.
 */
const YEAR = 2026;
const MONTH = 8;
const STANDARD_DAYS = 21;

const hrUser: AuthenticatedUser = {
  userId: 2,
  username: 'hr.manager',
  role: 'hr_manager',
  employeeId: 2,
  sessionId: 1,
};

const staffUser: AuthenticatedUser = {
  userId: 3,
  username: 'hr.staff',
  role: 'hr_staff',
  employeeId: 3,
  sessionId: 1,
};

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 51,
    employeeCode: 'NV0051',
    fullName: 'Nguyễn Văn Bình',
    departmentId: 2,
    status: 'active',
    ...overrides,
  } as unknown as Employee;
}

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 9,
    employeeId: 51,
    baseSalary: '21000000.00',
    insuranceSalary: '21000000.00',
    positionAllowance: '0.00',
    otherAllowance: '0.00',
    workingHours: '8.00',
    status: 'active',
    ...overrides,
  } as unknown as Contract;
}

function makeSettings(
  overrides: Partial<PayrollSettings> = {},
): PayrollSettings {
  return {
    id: 1,
    minimumWageRegion: 1,
    mealAllowance: '0.00',
    transportAllowance: '0.00',
    phoneAllowance: '0.00',
    attendanceAllowance: '0.00',
    payOvertime: true,
    ...overrides,
  } as unknown as PayrollSettings;
}

/** `n` ngày công có mặt, bắt đầu từ 03/08/2026 (thứ Hai). */
function workedDays(count: number): Attendance[] {
  return Array.from({ length: count }, (_, index) => {
    const day = 3 + index + Math.floor(index / 5) * 2;

    return {
      workDate: `2026-08-${String(day).padStart(2, '0')}`,
      status: 'present',
      checkIn: '08:00',
      checkOut: '17:00',
      overtimeHours: '0.00',
    } as unknown as Attendance;
  });
}

function makeAdvance(overrides: Partial<SalaryAdvance> = {}): SalaryAdvance {
  return {
    id: 3,
    employeeId: 51,
    amount: '5000000.00',
    deductedAmount: '0.00',
    advanceDate: '2026-07-28',
    deductMonth: MONTH,
    deductYear: YEAR,
    reason: 'Ứng trước',
    status: 'approved',
    ...overrides,
  } as unknown as SalaryAdvance;
}

async function captureError(
  run: () => Promise<unknown>,
): Promise<{ status: number; code: string }> {
  try {
    await run();
  } catch (error) {
    const exception = error as HttpException;
    const body = exception.getResponse() as { code: string };

    return { status: exception.getStatus(), code: body.code };
  }

  throw new Error('Expected the call to throw, but it resolved');
}

describe('PayrollService', () => {
  let module: TestingModule;
  let service: PayrollService;
  let repository: jest.Mocked<PayrollRepository>;
  let settings: PayrollSettings;
  /** Các dòng lương đã được ghi qua `manager.save()`. */
  let written: Salary[];
  /** Phần tạm ứng đã thu hồi được, do service báo lên repository. */
  let recoveries: { deducted: number }[];

  beforeEach(async () => {
    settings = makeSettings();
    written = [];
    recoveries = [];

    const manager = {
      save: jest.fn((_entity: unknown, rows: Salary[]) => {
        written = rows;
        return Promise.resolve(rows);
      }),
    } as unknown as EntityManager;

    module = await Test.createTestingModule({
      providers: [
        PayrollService,
        {
          provide: PayrollRepository,
          useValue: {
            findPayableEmployees: jest.fn().mockResolvedValue([makeEmployee()]),
            findActiveContracts: jest
              .fn()
              .mockResolvedValue(new Map([[51, makeContract()]])),
            findAttendanceInPeriod: jest
              .fn()
              .mockResolvedValue(new Map([[51, workedDays(STANDARD_DAYS)]])),
            countActiveDependents: jest.fn().mockResolvedValue(new Map()),
            findAdvancesForPeriod: jest.fn().mockResolvedValue(new Map()),
            findSalariesForPeriod: jest.fn().mockResolvedValue([]),
            recordAdvanceRecovery: jest.fn(
              (_manager: unknown, rows: { deducted: number }[]) => {
                recoveries = rows;
                return Promise.resolve();
              },
            ),
          },
        },
        {
          provide: PayrollSettingsService,
          useValue: { getSettings: jest.fn(() => Promise.resolve(settings)) },
        },
        {
          provide: LeaveRequestsRepository,
          useValue: { findApprovedInRange: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: HolidaysService,
          useValue: { findByYear: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(
              (run: (m: EntityManager) => Promise<unknown>) => run(manager),
            ),
          },
        },
      ],
    }).compile();

    service = module.get(PayrollService);
    repository = module.get(PayrollRepository);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('quyền', () => {
    /* `hr_staff` xem được bảng lương nhưng KHÔNG chạy tính lương. */
    it('refuses to run payroll for a role that can only read it', async () => {
      const error = await captureError(() =>
        service.calculate({ year: YEAR, month: MONTH }, staffUser),
      );

      expect(error).toEqual({ status: 403, code: 'FORBIDDEN' });
    });
  });

  describe('tính lương', () => {
    it('pays the full month when every standard day was worked', async () => {
      const result = await service.calculate(
        { year: YEAR, month: MONTH },
        hrUser,
      );

      expect(result.standardWorkingDays).toBe(STANDARD_DAYS);
      expect(result.created).toBe(1);
      expect(written[0].baseSalary).toBe('21000000.00');
    });

    /* PLAN 6.1: nghỉ 2 ngày không phép → lương bị trừ đúng 2 ngày công. */
    it('cuts two days of pay for two unpaid days off', async () => {
      repository.findAttendanceInPeriod.mockResolvedValue(
        new Map([[51, workedDays(STANDARD_DAYS - 2)]]),
      );

      await service.calculate({ year: YEAR, month: MONTH }, hrUser);

      expect(written[0].unpaidLeaveDays).toBe('2.0');
      // 21.000.000 ÷ 21 × 19 = 19.000.000
      expect(written[0].baseSalary).toBe('19000000.00');
    });

    /*
     * Phụ cấp chuyên cần MẤT TRẮNG khi có ngày nghỉ không lương — chia tỉ lệ thì
     * nó không còn là "chuyên cần" mà chỉ là một khoản lương khác.
     */
    it('drops the attendance allowance entirely on an unpaid day off', async () => {
      settings = makeSettings({ attendanceAllowance: '500000.00' });
      repository.findAttendanceInPeriod.mockResolvedValue(
        new Map([[51, workedDays(STANDARD_DAYS - 1)]]),
      );

      await service.calculate({ year: YEAR, month: MONTH }, hrUser);

      expect(written[0].attendanceAllowance).toBe('0.00');
    });

    it('keeps the attendance allowance on a full month', async () => {
      settings = makeSettings({ attendanceAllowance: '500000.00' });

      await service.calculate({ year: YEAR, month: MONTH }, hrUser);

      expect(written[0].attendanceAllowance).toBe('500000.00');
    });

    /*
     * Không có hợp đồng còn hiệu lực thì KHÔNG có căn cứ trả lương. Đoán một mức
     * lương để bảng không bị thiếu dòng là bịa ra tiền.
     */
    it('skips an employee without an active contract instead of guessing', async () => {
      repository.findActiveContracts.mockResolvedValue(new Map());

      const result = await service.calculate(
        { year: YEAR, month: MONTH },
        hrUser,
      );

      expect(result.skippedNoContract).toEqual(['NV0051']);
      expect(result.created).toBe(0);
    });

    /*
     * Tiền ăn ca là tiền bữa trưa của những ngày thực sự đi làm; trả trọn tháng
     * cho người nghỉ nửa tháng là trả tiền cơm cho những bữa không ai ăn.
     */
    it('prorates the meal allowance by the days actually worked', async () => {
      settings = makeSettings({ mealAllowance: '2100000.00' });
      repository.findAttendanceInPeriod.mockResolvedValue(
        new Map([[51, workedDays(14)]]),
      );

      await service.calculate({ year: YEAR, month: MONTH }, hrUser);

      // 2.100.000 ÷ 21 × 14 = 1.400.000
      expect(written[0].mealAllowance).toBe('1400000.00');
    });

    /*
     * Nghỉ không lương từ 14 ngày làm việc trở lên thì tháng đó không đóng bảo
     * hiểm (Điều 42 QĐ 595/QĐ-BHXH) — nếu không, bảng lương ra số âm.
     */
    it('charges no insurance for a month spent almost entirely unpaid', async () => {
      repository.findAttendanceInPeriod.mockResolvedValue(new Map([[51, []]]));

      await service.calculate({ year: YEAR, month: MONTH }, hrUser);

      expect(written[0].unpaidLeaveDays).toBe('21.0');
      expect(written[0].totalInsurance).toBe('0.00');
      expect(Number(written[0].netSalary)).toBeGreaterThanOrEqual(0);
    });

    it('deducts an approved advance from the net pay', async () => {
      repository.findAdvancesForPeriod.mockResolvedValue(
        new Map([[51, [makeAdvance({ amount: '5000000.00' })]]]),
      );

      await service.calculate({ year: YEAR, month: MONTH }, hrUser);

      expect(written[0].advanceDeduction).toBe('5000000.00');
      expect(recoveries).toEqual([
        expect.objectContaining({ deducted: 5_000_000 }),
      ]);
    });

    /*
     * MỘT BẢNG LƯƠNG KHÔNG BAO GIỜ RA SỐ ÂM. Người nghỉ gần trọn tháng thì thực
     * nhận gần bằng 0; trừ trọn khoản ứng ở đó là công ty đòi tiền nhân viên
     * ngay trên tờ phiếu lương của họ.
     */
    it('never deducts more of an advance than the pay can cover', async () => {
      repository.findAttendanceInPeriod.mockResolvedValue(new Map([[51, []]]));
      repository.findAdvancesForPeriod.mockResolvedValue(
        new Map([[51, [makeAdvance({ amount: '5000000.00' })]]]),
      );

      await service.calculate({ year: YEAR, month: MONTH }, hrUser);

      expect(written[0].advanceDeduction).toBe('0.00');
      expect(Number(written[0].netSalary)).toBeGreaterThanOrEqual(0);
      /*
       * Vẫn ghi lại phiếu với số 0: đây là lần dựng lại con số từ đầu, bỏ sót
       * phiếu sẽ để nguyên con số của lần chạy trước và nói sai.
       */
      expect(recoveries).toEqual([expect.objectContaining({ deducted: 0 })]);
    });

    /* Thu được bao nhiêu ghi bấy nhiêu; phần chưa thu vẫn hiện ở phiếu ứng. */
    /*
     * TÍNH LẠI MỘT KỲ PHẢI RA ĐÚNG CON SỐ CŨ. Cộng dồn phần thu hồi sẽ làm mỗi
     * lần chạy lại cộng thêm một lượt: chạy hai lần là phiếu ứng trông như đã
     * thu gấp đôi số tiền mà bảng lương thực sự trừ.
     */
    it('does not double-count the recovery when the period is recalculated', async () => {
      const advance = makeAdvance({ amount: '5000000.00' });

      repository.findAdvancesForPeriod.mockResolvedValue(
        new Map([[51, [advance]]]),
      );

      await service.calculate({ year: YEAR, month: MONTH }, hrUser);
      const first = recoveries[0].deducted;

      // Lần hai: phiếu đã mang `deductedAmount` của lần một.
      advance.deductedAmount = first.toFixed(2);
      await service.calculate({ year: YEAR, month: MONTH }, hrUser);

      expect(recoveries[0].deducted).toBe(first);
      expect(written[0].advanceDeduction).toBe(first.toFixed(2));
    });

    it('recovers an advance partially when the pay runs out', async () => {
      // 5 ngày công trên 21 ⇒ khoảng 5tr lương, không đủ cho khoản ứng 20tr.
      repository.findAttendanceInPeriod.mockResolvedValue(
        new Map([[51, workedDays(5)]]),
      );
      repository.findAdvancesForPeriod.mockResolvedValue(
        new Map([[51, [makeAdvance({ amount: '20000000.00' })]]]),
      );

      await service.calculate({ year: YEAR, month: MONTH }, hrUser);

      const deducted = Number(written[0].advanceDeduction);

      expect(deducted).toBeGreaterThan(0);
      expect(deducted).toBeLessThan(20_000_000);
      expect(Number(written[0].netSalary)).toBe(0);
      expect(recoveries[0].deducted).toBe(deducted);
    });

    /*
     * Khoản chỉnh tay được giữ qua mỗi lần tính lại — nhưng giữ mà không CỘNG
     * vào thì gross hụt đúng bằng khoản thưởng, và thuế lẫn thực nhận sai theo.
     */
    it('feeds a carried-over bonus into gross, not just into its own column', async () => {
      repository.findSalariesForPeriod.mockResolvedValue([
        {
          id: 5,
          employeeId: 51,
          status: SalaryStatus.CALCULATED,
          performanceBonus: '2000000.00',
          otherIncome: '0.00',
          otherDeductions: '0.00',
        } as Salary,
      ]);

      await service.calculate({ year: YEAR, month: MONTH }, hrUser);

      // Lương tháng đủ 21 ngày là 21tr, cộng thưởng 2tr.
      expect(written[0].performanceBonus).toBe('2000000.00');
      expect(written[0].grossSalary).toBe('23000000.00');
    });

    it('subtracts a carried-over other deduction from the net pay', async () => {
      repository.findSalariesForPeriod.mockResolvedValue([
        {
          id: 5,
          employeeId: 51,
          status: SalaryStatus.CALCULATED,
          performanceBonus: '0.00',
          otherIncome: '0.00',
          otherDeductions: '1000000.00',
        } as Salary,
      ]);

      await service.calculate({ year: YEAR, month: MONTH }, hrUser);

      const gross = Number(written[0].grossSalary);
      const insurance = Number(written[0].totalInsurance);
      const tax = Number(written[0].personalIncomeTax);

      expect(written[0].otherDeductions).toBe('1000000.00');
      expect(Number(written[0].netSalary)).toBe(
        gross - insurance - tax - 1_000_000,
      );
    });
  });

  describe('khoá bảng lương', () => {
    /* PLAN 6.1: bảng lương đã chốt thì không cho tính lại. */
    it.each([SalaryStatus.APPROVED, SalaryStatus.PAID])(
      'leaves a %s payslip untouched',
      async (status) => {
        repository.findSalariesForPeriod.mockResolvedValue([
          { id: 5, employeeId: 51, status } as Salary,
        ]);

        const result = await service.calculate(
          { year: YEAR, month: MONTH },
          hrUser,
        );

        expect(result.skippedLocked).toBe(1);
        expect(result.created).toBe(0);
        expect(result.updated).toBe(0);
        expect(written).toHaveLength(0);
      },
    );

    it('overwrites a payslip that is only calculated', async () => {
      repository.findSalariesForPeriod.mockResolvedValue([
        {
          id: 5,
          employeeId: 51,
          status: SalaryStatus.CALCULATED,
          performanceBonus: '1000000.00',
          otherIncome: '0.00',
          otherDeductions: '0.00',
        } as Salary,
      ]);

      const result = await service.calculate(
        { year: YEAR, month: MONTH },
        hrUser,
      );

      expect(result.updated).toBe(1);
      // Khoản chỉnh tay được GIỮ LẠI qua lần tính lại — nó không suy ra được từ
      // dữ liệu gốc, tính lại mà xoá đi thì kế toán phải nhập lại mỗi lần.
      expect(written[0].performanceBonus).toBe('1000000.00');
    });
  });

  describe('dryRun', () => {
    it('reports the numbers without writing anything', async () => {
      const result = await service.calculate(
        { year: YEAR, month: MONTH, dryRun: true },
        hrUser,
      );

      expect(result.dryRun).toBe(true);
      expect(result.created).toBe(1);
      expect(written).toHaveLength(0);
      expect(recoveries).toEqual([]);
    });
  });
});
