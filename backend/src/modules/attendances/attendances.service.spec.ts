import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { EmployeesService } from '@/modules/employees/employees.service';
import { Employee } from '@/modules/employees/entities/employee.entity';
import { OvertimeService } from '@/modules/overtime/overtime.service';
import { HolidaysService } from '@/modules/system/holidays.service';
import { AttendancesRepository } from './attendances.repository';
import { AttendancesService } from './attendances.service';
import { Attendance, AttendanceStatus } from './entities/attendance.entity';

/** Gắn timestamp như cột @CreateDateColumn/@UpdateDateColumn của DB. */
function stamp(record: Attendance): Attendance {
  const now = new Date('2026-05-25T01:00:00.000Z');
  record.createdAt = record.createdAt ?? now;
  record.updatedAt = now;
  return record;
}

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
    breakStart: null,
    breakEnd: null,
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

const hrUser: AuthenticatedUser = {
  userId: 2,
  username: 'hr.manager',
  role: 'hr_manager',
  employeeId: 2,
  sessionId: 1,
};

const managerUser: AuthenticatedUser = {
  userId: 4,
  username: 'manager',
  role: 'manager',
  employeeId: 12,
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

describe('AttendancesService', () => {
  let module: TestingModule;
  let service: AttendancesService;
  let repository: jest.Mocked<AttendancesRepository>;
  let employeesService: jest.Mocked<EmployeesService>;
  /** Bản ghi vừa được ghi xuống — mock `findById` đọc lại từ đây. */
  let lastWritten: Attendance | null;

  beforeEach(async () => {
    lastWritten = null;
    module = await Test.createTestingModule({
      providers: [
        AttendancesService,
        {
          provide: AttendancesRepository,
          useValue: {
            findPaginated: jest.fn().mockResolvedValue([[], 0]),
            /*
             * `create()` đọc lại bản ghi qua `findById` để lấy kèm quan hệ
             * `employee` cho response. Mock phải trả về ĐÚNG bản vừa ghi như DB
             * thật — trả một bản ghi khác thì test đọc trạng thái của một dòng
             * không liên quan và báo xanh/đỏ sai chỗ.
             */
            findById: jest.fn(() =>
              Promise.resolve(lastWritten ?? makeAttendance()),
            ),
            findByEmployeeAndDate: jest.fn().mockResolvedValue(null),
            findByEmployeeInRange: jest.fn().mockResolvedValue([]),
            create: jest.fn((record: Attendance) => {
              lastWritten = stamp(record);
              return Promise.resolve(lastWritten);
            }),
            save: jest.fn((record: Attendance) => {
              lastWritten = stamp(record);
              return Promise.resolve(lastWritten);
            }),
          },
        },
        {
          provide: EmployeesService,
          useValue: {
            resolveScope: jest.fn().mockResolvedValue({ kind: 'all' }),
            findOne: jest.fn().mockResolvedValue({ id: 51 }),
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
    employeesService = module.get(EmployeesService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /*
   * Hệ thống KHÔNG có chức năng tự chấm công — dữ liệu đến từ nền tảng ngoài,
   * vào bằng Excel hoặc nhập tay. Bài test này khoá điều đó lại: thêm lại một
   * endpoint tự chấm công sẽ làm nó đỏ.
   */
  it('exposes no self-service clock methods', () => {
    const surface = service as unknown as Record<string, unknown>;

    expect(surface.checkIn).toBeUndefined();
    expect(surface.checkOut).toBeUndefined();
    expect(surface.findMine).toBeUndefined();
  });

  describe('create – nhập tay một ngày công', () => {
    const base = {
      employeeId: 51,
      workDate: '2026-05-25',
      note: 'Nhân viên quên chấm, trưởng phòng xác nhận',
    };

    /* Cùng công thức với import: 08:00–17:30 = 8.5 giờ (đã trừ 1h nghỉ trưa). */
    it('computes the derived figures from the times', async () => {
      const result = await service.create(
        { ...base, checkIn: '08:00', checkOut: '17:30' },
        hrUser,
      );

      expect(result.workHours).toBe(8.5);
      expect(result.overtimeHours).toBe(0.5);
      expect(result.status).toBe(AttendanceStatus.PRESENT);
      expect(result.note).toBe(base.note);
    });

    it('marks an arrival more than 15 minutes late', async () => {
      const result = await service.create(
        { ...base, checkIn: '08:20', checkOut: '17:00' },
        hrUser,
      );

      expect(result.isLate).toBe(true);
      expect(result.lateMinutes).toBe(20);
      expect(result.status).toBe(AttendanceStatus.LATE);
    });

    /* PLAN 4.1: chưa có giờ ra thì giờ công là `null`, không phải 0. */
    it('leaves work hours null when only the check-in is known', async () => {
      const result = await service.create(
        { ...base, checkIn: '08:00' },
        hrUser,
      );

      expect(result.checkOut).toBeNull();
      expect(result.workHours).toBeNull();
    });

    /*
     * Một ngày nghỉ phép hay ngày lễ vẫn là một dòng trong bảng công, chỉ là
     * không có giờ vào. Bắt buộc giờ vào sẽ khiến người nhập phải bịa ra một
     * con số cho ngày không ai đi làm.
     */
    it('accepts a day with a status but no times at all', async () => {
      const result = await service.create(
        { ...base, status: AttendanceStatus.LEAVE },
        hrUser,
      );

      expect(result.status).toBe(AttendanceStatus.LEAVE);
      expect(result.checkIn).toBeNull();
      expect(result.workHours).toBeNull();
    });

    it('lets an explicit status win over the one derived from the times', async () => {
      const result = await service.create(
        {
          ...base,
          checkIn: '08:00',
          checkOut: '17:00',
          status: AttendanceStatus.WFH,
        },
        hrUser,
      );

      expect(result.status).toBe(AttendanceStatus.WFH);
    });

    /*
     * Cột UNIQUE (employee_id, work_date) sẽ chặn ở DB, nhưng bắt sớm thì người
     * nhập biết là ngày đó ĐÃ CÓ dữ liệu và phải chuyển sang sửa — lỗi driver
     * chỉ nói "trùng khoá".
     */
    it('refuses a day that already has a record instead of overwriting it', async () => {
      repository.findByEmployeeAndDate.mockResolvedValue(
        makeAttendance({ id: 9 }),
      );

      const error = await captureError(() =>
        service.create({ ...base, checkIn: '08:00' }, hrUser),
      );

      expect(error).toEqual({ status: 409, code: 'ATTENDANCE_ALREADY_EXISTS' });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects a check-out earlier than the check-in', async () => {
      const error = await captureError(() =>
        service.create(
          { ...base, checkIn: '17:00', checkOut: '08:00' },
          hrUser,
        ),
      );

      expect(error).toEqual({ status: 409, code: 'INVALID_ATTENDANCE_TIMES' });
    });

    /*
     * Trưởng phòng đọc được bảng công phòng mình nhưng KHÔNG nhập: một dòng
     * nhập tay là căn cứ trả lương không có bằng chứng từ máy chấm công, và
     * đây là lớp kiểm soát duy nhất của việc đó.
     */
    it('refuses a manager, who can read the department but not enter data', async () => {
      employeesService.resolveScope.mockResolvedValue({
        kind: 'department',
        departmentIds: [2],
      });

      const error = await captureError(() =>
        service.create({ ...base, checkIn: '08:00' }, managerUser),
      );

      expect(error).toEqual({ status: 403, code: 'FORBIDDEN' });
      expect(repository.create).not.toHaveBeenCalled();
    });

    /* Nhập cho hồ sơ không tồn tại chỉ nhận lỗi khoá ngoại — bắt sớm ở service. */
    it('checks the employee exists before writing', async () => {
      await service.create({ ...base, checkIn: '08:00' }, hrUser);

      expect(employeesService.findOne).toHaveBeenCalledWith(51, hrUser);
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

    it('lets HR set a status the times cannot imply, such as WFH', async () => {
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

    it('refuses a manager, who can read the department but not adjust it', async () => {
      employeesService.resolveScope.mockResolvedValue({
        kind: 'department',
        departmentIds: [2],
      });

      const error = await captureError(() =>
        service.update(1, { checkIn: '08:00', note: 'Sửa hộ' }, managerUser),
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
    /*
     * Vai trò `employee` không đăng nhập được nữa, nhưng phạm vi `self` vẫn
     * xuất hiện với tài khoản chưa gắn hồ sơ — và bảng công toàn công ty thì
     * không ai ngoài nhóm quản lý được đọc.
     */
    it('refuses a caller whose scope is limited to themselves', async () => {
      employeesService.resolveScope.mockResolvedValue({
        kind: 'self',
        employeeId: 51,
      });

      const error = await captureError(() => service.findAll({}, managerUser));

      expect(error).toEqual({ status: 403, code: 'FORBIDDEN' });
    });

    it('limits a manager to their own departments', async () => {
      employeesService.resolveScope.mockResolvedValue({
        kind: 'department',
        departmentIds: [2, 3],
      });

      await service.findAll({}, managerUser);

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
