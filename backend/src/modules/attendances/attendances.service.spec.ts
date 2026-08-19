import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import * as dateUtil from '@/common/utils/date.util';
import { EmployeesService } from '@/modules/employees/employees.service';
import { Employee } from '@/modules/employees/entities/employee.entity';
import { OvertimeService } from '@/modules/overtime/overtime.service';
import { HolidaysService } from '@/modules/system/holidays.service';
import { AttendancesRepository } from './attendances.repository';
import { AttendancesService } from './attendances.service';
import { Attendance, AttendanceStatus } from './entities/attendance.entity';

function makeAttendance(overrides: Partial<Attendance> = {}): Attendance {
  return {
    id: 1,
    employeeId: 51,
    employee: {
      id: 51,
      employeeCode: 'NV0051',
      fullName: 'Nguyễn Văn Bình',
      departmentId: 2,
    } as Employee,
    workDate: '2026-05-25',
    checkIn: null,
    checkOut: null,
    workHours: null,
    overtimeHours: '0.00',
    isLate: false,
    lateMinutes: 0,
    isEarlyLeave: false,
    earlyLeaveMinutes: 0,
    status: AttendanceStatus.PRESENT,
    leaveRequestId: null,
    leaveRequest: null,
    note: null,
    createdAt: new Date('2026-05-25T01:00:00.000Z'),
    updatedAt: new Date('2026-05-25T01:00:00.000Z'),
    ...overrides,
  };
}

const employeeUser: AuthenticatedUser = {
  userId: 9,
  username: 'an.hoang',
  role: 'employee',
  employeeId: 51,
  sessionId: 1,
};

const hrUser: AuthenticatedUser = {
  userId: 2,
  username: 'hr.manager',
  role: 'hr_manager',
  employeeId: 2,
  sessionId: 1,
};

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

/** Gắn timestamp như cột @CreateDateColumn/@UpdateDateColumn của DB. */
function stamp(record: Attendance): Attendance {
  const now = new Date('2026-05-25T01:00:00.000Z');
  record.createdAt = record.createdAt ?? now;
  record.updatedAt = now;
  return record;
}

/** Ghim đồng hồ: `checkIn`/`checkOut` đọc giờ từ server nên test phải điều khiển nó. */
function freezeClock(date: string, time: string): void {
  jest.spyOn(dateUtil, 'vietnamDateTime').mockReturnValue({ date, time });
}

describe('AttendancesService', () => {
  let module: TestingModule;
  let service: AttendancesService;
  let repository: jest.Mocked<AttendancesRepository>;
  let overtimeService: jest.Mocked<OvertimeService>;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        AttendancesService,
        {
          provide: AttendancesRepository,
          useValue: {
            findPaginated: jest.fn().mockResolvedValue([[], 0]),
            findById: jest.fn().mockResolvedValue(makeAttendance()),
            findByEmployeeAndDate: jest.fn().mockResolvedValue(null),
            findByEmployeeInRange: jest.fn().mockResolvedValue([]),
            // DB tự điền created_at/updated_at (@CreateDateColumn) — mock phải
            // làm y hệt, nếu không `toResponse` nhận undefined và ném RangeError
            // ở một chỗ không bao giờ xảy ra khi chạy thật.
            create: jest.fn((record: Attendance) =>
              Promise.resolve(stamp(record)),
            ),
            save: jest.fn((record: Attendance) =>
              Promise.resolve(stamp(record)),
            ),
          },
        },
        {
          provide: EmployeesService,
          useValue: {
            resolveScope: jest.fn().mockResolvedValue({ kind: 'all' }),
          },
        },
        {
          provide: HolidaysService,
          useValue: { findByYear: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: OvertimeService,
          useValue: { sumApprovedHours: jest.fn().mockResolvedValue(0) },
        },
      ],
    }).compile();

    service = module.get(AttendancesService);
    repository = module.get(AttendancesRepository);
    overtimeService = module.get(OvertimeService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('checkIn', () => {
    it('records the arrival time read from the server, not from the client', async () => {
      freezeClock('2026-05-25', '08:05');

      const result = await service.checkIn(employeeUser, {});

      expect(result.workDate).toBe('2026-05-25');
      expect(result.checkIn).toBe('08:05');
      expect(result.isLate).toBe(false);
      expect(result.status).toBe(AttendanceStatus.PRESENT);
    });

    it('marks an arrival more than 15 minutes late', async () => {
      freezeClock('2026-05-25', '08:20');

      const result = await service.checkIn(employeeUser, {});

      expect(result.isLate).toBe(true);
      expect(result.lateMinutes).toBe(20);
      expect(result.status).toBe(AttendanceStatus.LATE);
    });

    /* PLAN 4.1: "Check-in 2 lần trong ngày → chỉ tính lần đầu". */
    it('rejects a second check-in instead of overwriting the first', async () => {
      freezeClock('2026-05-25', '09:30');
      repository.findByEmployeeAndDate.mockResolvedValue(
        makeAttendance({ checkIn: '08:00:00' }),
      );

      const error = await captureError(() => service.checkIn(employeeUser, {}));

      expect(error).toEqual({ status: 409, code: 'ALREADY_CHECKED_IN' });
      expect(repository.save).not.toHaveBeenCalled();
    });

    /*
     * Bản ghi có thể đã tồn tại mà chưa có giờ vào. Tạo mới sẽ đụng UNIQUE
     * (employee_id, work_date) và trả 500 thay vì chấm công thành công.
     */
    it('updates an existing row that has no check-in yet', async () => {
      freezeClock('2026-05-25', '08:00');
      repository.findByEmployeeAndDate.mockResolvedValue(makeAttendance());

      await service.checkIn(employeeUser, {});

      expect(repository.save).toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('refuses a user with no employee profile', async () => {
      freezeClock('2026-05-25', '08:00');

      const error = await captureError(() =>
        service.checkIn({ ...employeeUser, employeeId: null }, {}),
      );

      expect(error).toEqual({ status: 403, code: 'FORBIDDEN' });
    });
  });

  describe('checkOut', () => {
    /* PLAN 4.1: "Check-in lúc 8h, check-out lúc 17h30 → 8.5 giờ công". */
    it('computes 8.5 work hours for 08:00 to 17:30', async () => {
      freezeClock('2026-05-25', '17:30');
      repository.findByEmployeeAndDate.mockResolvedValue(
        makeAttendance({ checkIn: '08:00:00' }),
      );

      const result = await service.checkOut(employeeUser, {});

      expect(result.checkIn).toBe('08:00');
      expect(result.checkOut).toBe('17:30');
      expect(result.workHours).toBe(8.5);
      expect(result.overtimeHours).toBe(0.5);
      expect(result.status).toBe(AttendanceStatus.PRESENT);
    });

    it('flags leaving more than 15 minutes early', async () => {
      freezeClock('2026-05-25', '16:00');
      repository.findByEmployeeAndDate.mockResolvedValue(
        makeAttendance({ checkIn: '08:00:00' }),
      );

      const result = await service.checkOut(employeeUser, {});

      expect(result.isEarlyLeave).toBe(true);
      expect(result.earlyLeaveMinutes).toBe(60);
      expect(result.status).toBe(AttendanceStatus.EARLY_LEAVE);
    });

    /*
     * Suy ra giờ vào từ khung giờ chuẩn là bịa ra một dữ kiện dùng để trả
     * lương. Thà báo lỗi để HR điều chỉnh có ghi lý do.
     */
    it('refuses to check out without a check-in rather than guessing one', async () => {
      freezeClock('2026-05-25', '17:30');
      repository.findByEmployeeAndDate.mockResolvedValue(null);

      const error = await captureError(() =>
        service.checkOut(employeeUser, {}),
      );

      expect(error).toEqual({ status: 404, code: 'NOT_CHECKED_IN' });
    });

    it('rejects a second check-out', async () => {
      freezeClock('2026-05-25', '18:00');
      repository.findByEmployeeAndDate.mockResolvedValue(
        makeAttendance({ checkIn: '08:00:00', checkOut: '17:30:00' }),
      );

      const error = await captureError(() =>
        service.checkOut(employeeUser, {}),
      );

      expect(error).toEqual({ status: 409, code: 'ALREADY_CHECKED_OUT' });
    });
  });

  /* PLAN 4.1: "Chưa check-out → check_out_time null, giờ công = null". */
  describe('bản ghi chưa chấm ra', () => {
    it('leaves checkOut and workHours null after check-in alone', async () => {
      freezeClock('2026-05-25', '08:00');

      const result = await service.checkIn(employeeUser, {});

      expect(result.checkOut).toBeNull();
      expect(result.workHours).toBeNull();
    });
  });

  /* PLAN 4.1: "Tổng hợp tháng đúng với dữ liệu check-in/out". */
  describe('findMine – tổng hợp tháng', () => {
    beforeEach(() => {
      freezeClock('2026-05-31', '18:00');
    });

    it('adds up work hours, late days and overtime across the month', async () => {
      repository.findByEmployeeInRange.mockResolvedValue([
        makeAttendance({
          workDate: '2026-05-04',
          checkIn: '08:00:00',
          checkOut: '17:00:00',
          workHours: '8.00',
          overtimeHours: '0.00',
        }),
        makeAttendance({
          workDate: '2026-05-05',
          checkIn: '08:30:00',
          checkOut: '17:30:00',
          workHours: '8.00',
          overtimeHours: '0.00',
          isLate: true,
          lateMinutes: 30,
          status: AttendanceStatus.LATE,
        }),
        makeAttendance({
          workDate: '2026-05-06',
          checkIn: '08:00:00',
          checkOut: '19:00:00',
          workHours: '10.00',
          overtimeHours: '2.00',
        }),
      ]);
      overtimeService.sumApprovedHours.mockResolvedValue(2);

      const result = await service.findMine(employeeUser, {
        month: 5,
        year: 2026,
      });

      expect(result.month).toBe(5);
      expect(result.summary.presentDays).toBe(3);
      expect(result.summary.lateDays).toBe(1);
      expect(result.summary.totalWorkHours).toBe(26);
      expect(result.summary.overtimeHours).toBe(2);
      expect(result.records).toHaveLength(3);
    });

    /*
     * Hai con số làm thêm phải đứng riêng: giờ ở lại thực tế là dữ kiện, giờ
     * đã duyệt mới là tiền. Gộp lại thì ai ở lại muộn cũng tự phát sinh nghĩa
     * vụ trả lương cho công ty.
     */
    it('keeps hours actually worked separate from approved overtime', async () => {
      repository.findByEmployeeInRange.mockResolvedValue([
        makeAttendance({
          workDate: '2026-05-06',
          checkIn: '08:00:00',
          checkOut: '21:00:00',
          workHours: '12.00',
          overtimeHours: '4.00',
        }),
      ]);
      // Chỉ 2 trong 4 giờ ở lại là có đơn được duyệt.
      overtimeService.sumApprovedHours.mockResolvedValue(2);

      const result = await service.findMine(employeeUser, {
        month: 5,
        year: 2026,
      });

      expect(result.summary.overtimeHours).toBe(4);
      expect(result.summary.approvedOvertimeHours).toBe(2);
    });

    it('counts Monday-to-Friday as working days and skips public holidays', async () => {
      const holidays = module.get<HolidaysService>(HolidaysService);
      jest
        .spyOn(holidays, 'findByYear')
        .mockResolvedValue([{ holidayDate: '2026-05-01' }] as Awaited<
          ReturnType<HolidaysService['findByYear']>
        >);

      const result = await service.findMine(employeeUser, {
        month: 5,
        year: 2026,
      });

      // Tháng 5/2026 có 21 ngày T2–T6; 01/05 là ngày lễ → còn 20.
      expect(result.summary.workingDays).toBe(20);
    });

    /*
     * Mở bảng công ngày mùng 3 mà thấy "vắng 18 ngày" là một bản báo cáo kỷ
     * luật sai sự thật về những ngày còn chưa xảy ra.
     */
    it('does not count days that have not happened yet as absent', async () => {
      freezeClock('2026-05-04', '09:00');
      repository.findByEmployeeInRange.mockResolvedValue([
        makeAttendance({ workDate: '2026-05-04', checkIn: '08:00:00' }),
      ]);

      const result = await service.findMine(employeeUser, {
        month: 5,
        year: 2026,
      });

      // 01/05 và 04/05 là ngày làm việc đã qua; 04/05 có chấm công.
      expect(result.summary.absentDays).toBe(1);
      expect(result.summary.workingDays).toBe(21);
    });

    it('reports zero absences for a month in the future', async () => {
      freezeClock('2026-05-04', '09:00');

      const result = await service.findMine(employeeUser, {
        month: 12,
        year: 2026,
      });

      expect(result.summary.absentDays).toBe(0);
    });
  });

  describe('update – HR điều chỉnh', () => {
    it('recomputes the derived figures when the times change', async () => {
      repository.findById.mockResolvedValue(
        makeAttendance({
          checkIn: '09:00:00',
          checkOut: '17:00:00',
          workHours: '7.00',
          isLate: true,
          lateMinutes: 60,
          status: AttendanceStatus.LATE,
        }),
      );

      const result = await service.update(
        1,
        { checkIn: '08:00', checkOut: '17:30', note: 'Máy chấm công lỗi' },
        hrUser,
      );

      expect(result.workHours).toBe(8.5);
      expect(result.isLate).toBe(false);
      expect(result.lateMinutes).toBe(0);
      expect(result.status).toBe(AttendanceStatus.PRESENT);
      expect(result.note).toBe('Máy chấm công lỗi');
    });

    it('rejects a check-out earlier than the check-in', async () => {
      repository.findById.mockResolvedValue(
        makeAttendance({ checkIn: '08:00:00' }),
      );

      const error = await captureError(() =>
        service.update(1, { checkOut: '07:00', note: 'Nhập nhầm' }, hrUser),
      );

      expect(error).toEqual({ status: 409, code: 'INVALID_ATTENDANCE_TIMES' });
    });

    it('lets HR set a status the clock cannot infer, such as WFH', async () => {
      repository.findById.mockResolvedValue(
        makeAttendance({ checkIn: '08:00:00', checkOut: '17:00:00' }),
      );

      const result = await service.update(
        1,
        { status: AttendanceStatus.WFH, note: 'Làm việc tại nhà' },
        hrUser,
      );

      expect(result.status).toBe(AttendanceStatus.WFH);
    });

    /*
     * Trưởng phòng đọc được bảng công phòng mình nhưng KHÔNG sửa được: sửa giờ
     * công là sửa căn cứ trả lương, và đó là lớp kiểm soát duy nhất của việc đó.
     */
    it('refuses a manager, who can read the department but not adjust it', async () => {
      const employees = module.get<EmployeesService>(EmployeesService);
      jest
        .spyOn(employees, 'resolveScope')
        .mockResolvedValue({ kind: 'department', departmentIds: [2] });

      const error = await captureError(() =>
        service.update(
          1,
          { checkIn: '08:00', note: 'Sửa hộ' },
          {
            ...employeeUser,
            role: 'manager',
          },
        ),
      );

      expect(error).toEqual({ status: 403, code: 'FORBIDDEN' });
    });

    it('returns 404 for a record that does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      const error = await captureError(() =>
        service.update(999, { note: 'Không có' }, hrUser),
      );

      expect(error).toEqual({ status: 404, code: 'ATTENDANCE_NOT_FOUND' });
    });
  });

  describe('findAll – phạm vi dữ liệu', () => {
    it('refuses a plain employee and points at /attendances/me', async () => {
      const employees = module.get<EmployeesService>(EmployeesService);
      jest
        .spyOn(employees, 'resolveScope')
        .mockResolvedValue({ kind: 'self', employeeId: 51 });

      const error = await captureError(() => service.findAll({}, employeeUser));

      expect(error).toEqual({ status: 403, code: 'FORBIDDEN' });
    });

    it('limits a manager to their own departments', async () => {
      const employees = module.get<EmployeesService>(EmployeesService);
      jest
        .spyOn(employees, 'resolveScope')
        .mockResolvedValue({ kind: 'department', departmentIds: [2, 3] });

      await service.findAll({}, { ...employeeUser, role: 'manager' });

      expect(repository.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ departmentScope: [2, 3] }),
      );
    });

    /*
     * "Tháng 5" của năm nào? Tự điền năm hiện tại sẽ trả về dữ liệu mà người
     * gọi không hề yêu cầu.
     */
    it('ignores a month with no year rather than assuming the current year', async () => {
      await service.findAll({ month: 5 }, hrUser);

      expect(repository.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ dateRange: undefined }),
      );
    });

    it('turns month and year into a full-month range', async () => {
      await service.findAll({ month: 2, year: 2028 }, hrUser);

      // 2028 nhuận — ngày cuối tháng 2 là 29, không phải 28 hay 31.
      expect(repository.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({
          dateRange: { from: '2028-02-01', to: '2028-02-29' },
        }),
      );
    });
  });
});
