import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import {
  Attendance,
  AttendanceStatus,
} from '@/modules/attendances/entities/attendance.entity';
import { EmployeesService } from '@/modules/employees/employees.service';
import { Employee } from '@/modules/employees/entities/employee.entity';
import { LeaveBalance } from '@/modules/leave-balances/entities/leave-balance.entity';
import {
  LeaveHalf,
  LeaveRequest,
  LeaveRequestStatus,
} from '@/modules/leaves/entities/leave-request.entity';
import { LeaveType } from '@/modules/leaves/entities/leave-type.entity';
import { LeaveTypesRepository } from '@/modules/leaves/leave-types.repository';
import { HolidaysService } from '@/modules/system/holidays.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { LeaveRequestsRepository } from './leave-requests.repository';
import { LeaveRequestsService } from './leave-requests.service';

/* 2026-05-04 thứ Hai · 2026-05-08 thứ Sáu · 2026-05-09 thứ Bảy. */
const MONDAY = '2026-05-04';
const FRIDAY = '2026-05-08';

const SUBJECT_EMPLOYEE_ID = 51;

function makeLeaveType(overrides: Partial<LeaveType> = {}): LeaveType {
  return {
    id: 1,
    code: 'ANNUAL',
    name: 'Nghỉ phép năm',
    daysPerYear: '12.0',
    isPaid: true,
    requireApproval: true,
    minDays: '0.5',
    maxConsecutive: null,
    advanceNoticeDays: 1,
    isSystem: true,
    isActive: true,
    sortOrder: 1,
    ...overrides,
  } as unknown as LeaveType;
}

function makeRequest(overrides: Partial<LeaveRequest> = {}): LeaveRequest {
  return {
    id: 33,
    employeeId: SUBJECT_EMPLOYEE_ID,
    employee: {
      id: SUBJECT_EMPLOYEE_ID,
      employeeCode: 'NV0051',
      fullName: 'Nguyễn Văn Bình',
      departmentId: 2,
    } as Employee,
    leaveTypeId: 1,
    leaveType: makeLeaveType(),
    startDate: MONDAY,
    endDate: FRIDAY,
    startHalf: LeaveHalf.FULL,
    endHalf: LeaveHalf.FULL,
    totalDays: '5.0',
    reason: 'Nghỉ phép năm về quê',
    recordedBy: 12,
    recorder: null,
    status: LeaveRequestStatus.PENDING,
    approvedBy: null,
    approver: null,
    approvedAt: null,
    rejectedReason: null,
    attachmentUrl: null,
    createdAt: new Date('2026-04-20T02:00:00.000Z'),
    updatedAt: new Date('2026-04-20T02:00:00.000Z'),
    ...overrides,
  };
}

function makeBalance(overrides: Partial<LeaveBalance> = {}): LeaveBalance {
  return {
    id: 88,
    employeeId: SUBJECT_EMPLOYEE_ID,
    leaveTypeId: 1,
    year: 2026,
    allocatedDays: '12.0',
    carriedOver: '0.0',
    usedDays: '0.0',
    pendingDays: '0.0',
    remainingDays: '12.0',
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as LeaveBalance;
}

function makeDto(
  overrides: Partial<CreateLeaveRequestDto> = {},
): CreateLeaveRequestDto {
  return {
    employeeId: SUBJECT_EMPLOYEE_ID,
    leaveTypeId: 1,
    startDate: MONDAY,
    endDate: FRIDAY,
    reason: 'Nghỉ phép năm về quê',
    ...overrides,
  };
}

/** Trưởng phòng — GHI NHẬN đơn cho nhân viên phòng mình. */
const managerUser: AuthenticatedUser = {
  userId: 4,
  username: 'manager',
  role: 'manager',
  employeeId: 12,
  sessionId: 1,
};

/** Nhân sự — DUYỆT. */
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

describe('LeaveRequestsService', () => {
  let module: TestingModule;
  let service: LeaveRequestsService;
  let repository: jest.Mocked<LeaveRequestsRepository>;
  let employeesService: jest.Mocked<EmployeesService>;

  /** Quỹ phép mà transaction giả đọc/ghi — mỗi test tự dựng lại. */
  let balance: LeaveBalance | null;
  /** Những bản ghi chấm công đã bị ghi trong transaction. */
  let attendanceWrites: Attendance[];
  /** Ngày đã có sẵn dữ liệu chấm công (gây xung đột khi duyệt). */
  let existingAttendanceDates: Set<string>;
  /**
   * Đơn được tạo TRONG transaction.
   *
   * Service dùng `manager.create()` chứ không phải `repository.create()`: đơn và
   * quỹ phép phải nằm trong CÙNG một transaction, nên không thể đi qua repository
   * riêng. Test vì thế cũng phải đọc ở đây.
   */
  let createdRequest: Record<string, unknown> | null;
  /** Dòng chấm công đang mang `leave_request_id` của đơn — dùng khi xoá đơn. */
  let attendanceRows: Attendance[];
  /** Mọi lệnh `manager.delete()` mà service đã gọi. */
  let deletions: { entity: unknown; criteria: unknown }[];
  /** Đơn được ghi lại TRONG transaction (sửa đơn). */
  let savedRequest: LeaveRequest | null;

  beforeEach(async () => {
    balance = makeBalance();
    attendanceWrites = [];
    createdRequest = null;
    attendanceRows = [];
    deletions = [];
    savedRequest = null;
    existingAttendanceDates = new Set();

    /*
     * `EntityManager` giả, đủ dùng cho service: `findOne` phân biệt theo entity,
     * `create` trả nguyên object, `save` ghi lại. Dựng thật một DataSource sẽ
     * biến bài test đơn vị thành bài test tích hợp cần MySQL.
     */
    const manager = {
      findOne: jest.fn(
        (entity: unknown, options: { where: Record<string, unknown> }) => {
          if (entity === LeaveBalance) {
            return Promise.resolve(balance);
          }
          if (entity === Attendance) {
            const workDate = options.where.workDate as string;
            return Promise.resolve(
              existingAttendanceDates.has(workDate)
                ? ({ id: 1, workDate } as Attendance)
                : null,
            );
          }
          return Promise.resolve(null);
        },
      ),
      create: jest.fn((entity: unknown, data: unknown) => {
        if (entity === LeaveRequest) {
          createdRequest = data as Record<string, unknown>;
        }
        return data;
      }),
      save: jest.fn((entityOrData: unknown) => {
        const record = entityOrData as Record<string, unknown>;
        if ('status' in record && 'workDate' in record) {
          attendanceWrites.push(record as unknown as Attendance);
        }
        if ('pendingDays' in record) {
          balance = record as unknown as LeaveBalance;
        }
        if ('totalDays' in record && 'startDate' in record) {
          savedRequest = record as unknown as LeaveRequest;
        }
        return Promise.resolve({ id: 33, ...record });
      }),
      find: jest.fn((entity: unknown) =>
        Promise.resolve(entity === Attendance ? attendanceRows : []),
      ),
      delete: jest.fn((entity: unknown, criteria: unknown) => {
        deletions.push({ entity, criteria });
        return Promise.resolve({ affected: 1 });
      }),
    } as unknown as EntityManager;

    module = await Test.createTestingModule({
      providers: [
        LeaveRequestsService,
        {
          provide: LeaveRequestsRepository,
          useValue: {
            findPaginated: jest.fn().mockResolvedValue([[], 0]),
            findById: jest.fn().mockResolvedValue(makeRequest()),
            findActiveOverlapping: jest.fn().mockResolvedValue([]),
            findApprovedInRange: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockResolvedValue(makeRequest()),
            save: jest.fn((request: LeaveRequest) => Promise.resolve(request)),
          },
        },
        {
          provide: LeaveTypesRepository,
          useValue: { findById: jest.fn().mockResolvedValue(makeLeaveType()) },
        },
        {
          provide: EmployeesService,
          useValue: {
            resolveScope: jest.fn().mockResolvedValue({ kind: 'all' }),
            findOne: jest.fn().mockResolvedValue({ id: SUBJECT_EMPLOYEE_ID }),
          },
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

    service = module.get(LeaveRequestsService);
    repository = module.get(LeaveRequestsRepository);
    employeesService = module.get(EmployeesService);
  });

  describe('create – quản lý ghi nhận cho nhân viên', () => {
    /*
     * Nhân viên không đăng nhập, nên đơn luôn được ghi CHO người khác.
     * `recorded_by` lấy từ token, không lấy từ body.
     */
    it('stores the recorder from the token, not from the payload', async () => {
      await service.create(makeDto(), managerUser);

      expect(createdRequest).toEqual(
        expect.objectContaining({
          employeeId: SUBJECT_EMPLOYEE_ID,
          recordedBy: managerUser.employeeId,
          status: LeaveRequestStatus.PENDING,
        }),
      );
    });

    /* Số ngày do SERVER tính — client không gửi `totalDays` lên được. */
    it('computes the deducted days on the server', async () => {
      await service.create(makeDto(), managerUser);

      expect(createdRequest).toEqual(
        expect.objectContaining({ totalDays: '5.0' }),
      );
    });

    it('does not charge leave for a weekend inside the range', async () => {
      // T6 08/05 → T2 11/05: chỉ 2 ngày phép.
      await service.create(
        makeDto({ startDate: FRIDAY, endDate: '2026-05-11' }),
        managerUser,
      );

      expect(createdRequest).toEqual(
        expect.objectContaining({ totalDays: '2.0' }),
      );
    });

    it('does not charge leave for a public holiday inside the range', async () => {
      const holidays = module.get<HolidaysService>(HolidaysService);
      jest
        .spyOn(holidays, 'findByYear')
        .mockResolvedValue([{ holidayDate: '2026-05-06' }] as Awaited<
          ReturnType<HolidaysService['findByYear']>
        >);

      await service.create(makeDto(), managerUser);

      expect(createdRequest).toEqual(
        expect.objectContaining({ totalDays: '4.0' }),
      );
    });

    it('charges half a day for a half-day start', async () => {
      await service.create(
        makeDto({ startHalf: LeaveHalf.AFTERNOON }),
        managerUser,
      );

      expect(createdRequest).toEqual(
        expect.objectContaining({ totalDays: '4.5' }),
      );
    });

    /* PLAN 5.1: "Nộp đơn 3 ngày: pending_days tăng 3". */
    it('holds the days on the balance as pending', async () => {
      await service.create(
        makeDto({ startDate: MONDAY, endDate: '2026-05-06' }),
        managerUser,
      );

      expect(balance?.pendingDays).toBe('3.0');
      expect(balance?.usedDays).toBe('0.0');
    });

    /* PLAN 5.1: "Nộp đơn vượt quá số ngày còn lại → lỗi". */
    it('refuses a request that exceeds the remaining balance', async () => {
      balance = makeBalance({ allocatedDays: '3.0' });

      const error = await captureError(() =>
        service.create(makeDto(), managerUser),
      );

      expect(error).toEqual({
        status: 422,
        code: 'INSUFFICIENT_LEAVE_BALANCE',
      });
    });

    /*
     * Không phải loại phép nào cũng có quỹ — ốm đau, thai sản, tang chế phát
     * sinh theo sự việc. Không có quỹ thì đơn vẫn ghi được, chỉ là không trừ gì.
     */
    it('records a request for a leave type with no balance at all', async () => {
      balance = null;

      await expect(
        service.create(makeDto({ leaveTypeId: 2 }), managerUser),
      ).resolves.toBeDefined();
    });

    /* PLAN 5.1: "Nộp đơn trùng ngày đang có đơn khác → lỗi". */
    it('refuses a range overlapping an active request', async () => {
      repository.findActiveOverlapping.mockResolvedValue([
        makeRequest({ id: 9, startDate: '2026-05-06', endDate: '2026-05-07' }),
      ]);

      const error = await captureError(() =>
        service.create(makeDto(), managerUser),
      );

      expect(error).toEqual({ status: 409, code: 'OVERLAPPING_LEAVE' });
    });

    /*
     * Quỹ phép là con số của MỘT năm. Kỳ nghỉ bắc qua giao thừa rút từ hai quỹ
     * khác nhau; trừ hết vào một năm sẽ làm sai cả hai.
     */
    it('refuses a range spanning two calendar years', async () => {
      const error = await captureError(() =>
        service.create(
          makeDto({ startDate: '2026-12-28', endDate: '2027-01-05' }),
          managerUser,
        ),
      );

      expect(error).toEqual({ status: 422, code: 'LEAVE_SPANS_TWO_YEARS' });
    });

    /* Một đơn trừ 0 ngày là một đơn không có nội dung. */
    it('refuses a range that is entirely weekend', async () => {
      const error = await captureError(() =>
        service.create(
          makeDto({ startDate: '2026-05-09', endDate: '2026-05-10' }),
          managerUser,
        ),
      );

      expect(error).toEqual({ status: 422, code: 'LEAVE_NO_WORKING_DAYS' });
    });

    it('refuses an end date before the start date', async () => {
      const error = await captureError(() =>
        service.create(
          makeDto({ startDate: FRIDAY, endDate: MONDAY }),
          managerUser,
        ),
      );

      expect(error).toEqual({ status: 422, code: 'INVALID_LEAVE_RANGE' });
    });

    it('enforces the max consecutive days of the leave type', async () => {
      const leaveTypes = module.get<LeaveTypesRepository>(LeaveTypesRepository);
      jest
        .spyOn(leaveTypes, 'findById')
        .mockResolvedValue(makeLeaveType({ maxConsecutive: 3 }));

      const error = await captureError(() =>
        service.create(makeDto(), managerUser),
      );

      expect(error).toEqual({
        status: 422,
        code: 'LEAVE_ABOVE_MAX_CONSECUTIVE',
      });
    });

    it('refuses a role that cannot record leave at all', async () => {
      const error = await captureError(() =>
        service.create(makeDto(), { ...managerUser, role: 'employee' }),
      );

      expect(error).toEqual({ status: 403, code: 'FORBIDDEN' });
    });

    /* Trưởng phòng chỉ ghi được cho người trong phòng mình. */
    it('checks the subject is within the recorder scope', async () => {
      await service.create(makeDto(), managerUser);

      expect(employeesService.findOne).toHaveBeenCalledWith(
        SUBJECT_EMPLOYEE_ID,
        managerUser,
      );
    });
  });

  describe('approve – nhân sự duyệt', () => {
    /* PLAN 5.1: "Duyệt đơn: pending_days giảm 3, used_days tăng 3". */
    it('moves the days from pending to used', async () => {
      balance = makeBalance({ pendingDays: '5.0' });

      await service.approve(33, hrUser);

      expect(balance?.pendingDays).toBe('0.0');
      expect(balance?.usedDays).toBe('5.0');
    });

    /*
     * Ghi ngày nghỉ vào bảng chấm công là thứ khiến `absentDays` không tính
     * người nghỉ phép là vắng mặt.
     */
    it('writes the leave days into the timesheet', async () => {
      const result = await service.approve(33, hrUser);

      expect(result.attendanceDaysWritten).toBe(5);
      expect(attendanceWrites).toHaveLength(5);
      expect(attendanceWrites[0]).toEqual(
        expect.objectContaining({ status: 'leave', leaveRequestId: 33 }),
      );
    });

    /*
     * Vừa có giờ chấm công vừa được duyệt nghỉ phép trong cùng ngày là mâu
     * thuẫn cần người xem — không ghi đè, và báo ra để xử lý.
     */
    it('does not overwrite a day that already has attendance data', async () => {
      existingAttendanceDates.add('2026-05-06');

      const result = await service.approve(33, hrUser);

      expect(result.attendanceConflicts).toEqual(['2026-05-06']);
      expect(result.attendanceDaysWritten).toBe(4);
      expect(attendanceWrites).toHaveLength(4);
    });

    /* Trưởng phòng ghi nhận nhưng KHÔNG duyệt. */
    it('refuses a manager', async () => {
      const error = await captureError(() => service.approve(33, managerUser));

      expect(error).toEqual({ status: 403, code: 'FORBIDDEN' });
    });

    it('refuses the person who recorded the request', async () => {
      repository.findById.mockResolvedValue(
        makeRequest({ recordedBy: hrUser.employeeId }),
      );

      const error = await captureError(() => service.approve(33, hrUser));

      expect(error).toEqual({ status: 403, code: 'CANNOT_APPROVE_OWN_RECORD' });
    });

    it('allows approval when the recorder is unknown on a legacy row', async () => {
      repository.findById.mockResolvedValue(makeRequest({ recordedBy: null }));

      await expect(service.approve(33, hrUser)).resolves.toBeDefined();
    });

    it('refuses to approve a request that is no longer pending', async () => {
      repository.findById.mockResolvedValue(
        makeRequest({ status: LeaveRequestStatus.APPROVED }),
      );

      const error = await captureError(() => service.approve(33, hrUser));

      expect(error).toEqual({ status: 409, code: 'LEAVE_NOT_PENDING' });
    });
  });

  describe('reject', () => {
    /* PLAN 5.1: "Từ chối: pending_days giảm 3, số ngày hoàn lại". */
    it('releases the held days back to the balance', async () => {
      balance = makeBalance({ pendingDays: '5.0' });

      await service.reject(33, { reason: 'Trùng lịch nghỉ của phòng' }, hrUser);

      expect(balance?.pendingDays).toBe('0.0');
      expect(balance?.usedDays).toBe('0.0');
    });

    it('stores the reason so the recorder knows what to fix', async () => {
      await service.reject(33, { reason: 'Trùng lịch nghỉ của phòng' }, hrUser);

      expect(repository.findById).toHaveBeenCalled();
    });

    it('refuses a manager here too', async () => {
      const error = await captureError(() =>
        service.reject(33, { reason: 'Không duyệt' }, managerUser),
      );

      expect(error).toEqual({ status: 403, code: 'FORBIDDEN' });
    });
  });

  describe('cancel – người ghi rút lại đơn', () => {
    it('releases the held days back to the balance', async () => {
      balance = makeBalance({ pendingDays: '5.0' });
      employeesService.resolveScope.mockResolvedValue({
        kind: 'department',
        departmentIds: [2],
      });

      await service.cancel(33, managerUser);

      expect(balance?.pendingDays).toBe('0.0');
    });

    it('refuses a manager who did not record the request', async () => {
      employeesService.resolveScope.mockResolvedValue({
        kind: 'department',
        departmentIds: [2],
      });
      repository.findById.mockResolvedValue(makeRequest({ recordedBy: 999 }));

      const error = await captureError(() => service.cancel(33, managerUser));

      expect(error).toEqual({ status: 403, code: 'FORBIDDEN' });
    });

    /*
     * Đơn đã duyệt đã ghi vào bảng chấm công — gỡ lặng lẽ thì bảng công còn
     * dòng `leave` mà không còn đơn nào giải thích.
     */
    it('refuses to withdraw a request that was already approved', async () => {
      repository.findById.mockResolvedValue(
        makeRequest({ status: LeaveRequestStatus.APPROVED }),
      );

      const error = await captureError(() => service.cancel(33, hrUser));

      expect(error).toEqual({ status: 409, code: 'LEAVE_NOT_PENDING' });
    });
  });

  describe('update', () => {
    it('recomputes the deducted days from the new range', async () => {
      // 04–08/05 (5 ngày) rút về 04–05/05 (2 ngày).
      balance = makeBalance({ pendingDays: '5.0' });

      await service.update(33, { endDate: '2026-05-05' }, hrUser);

      expect(balance?.pendingDays).toBe('2.0');
    });

    it('releases the old hold before taking the new one', async () => {
      /*
       * Quỹ 12 ngày đang giữ 5 cho chính đơn này. Sửa thành 10 ngày CHỈ đủ chỗ
       * nếu 5 ngày cũ được trả lại trước — giữ trước trả sau sẽ đòi 15/12 và
       * ném INSUFFICIENT_LEAVE_BALANCE oan.
       */
      balance = makeBalance({ allocatedDays: '10.0', pendingDays: '5.0' });

      await service.update(
        33,
        { startDate: '2026-05-04', endDate: '2026-05-15' },
        hrUser,
      );

      expect(balance?.pendingDays).toBe('10.0');
    });

    it('does not count the request being edited as an overlap', async () => {
      await service.update(33, { endDate: '2026-05-05' }, hrUser);

      expect(repository.findActiveOverlapping).toHaveBeenCalledWith(
        SUBJECT_EMPLOYEE_ID,
        MONDAY,
        '2026-05-05',
        33,
      );
    });

    it('leaves the fields the caller did not send alone', async () => {
      await service.update(33, { reason: 'Đổi lý do cho rõ hơn' }, hrUser);

      // PATCH một trường không được âm thầm kéo theo khoảng ngày hay số ngày.
      expect(savedRequest?.reason).toBe('Đổi lý do cho rõ hơn');
      expect(savedRequest?.startDate).toBe(MONDAY);
      expect(savedRequest?.endDate).toBe(FRIDAY);
      expect(savedRequest?.totalDays).toBe('5.0');
    });

    it('refuses to edit a request that is no longer pending', async () => {
      repository.findById.mockResolvedValue(
        makeRequest({ status: LeaveRequestStatus.APPROVED }),
      );

      const error = await captureError(() =>
        service.update(33, { endDate: '2026-05-05' }, hrUser),
      );

      expect(error).toEqual({ status: 409, code: 'LEAVE_NOT_PENDING' });
    });

    it('refuses a manager editing a request they did not record', async () => {
      employeesService.resolveScope.mockResolvedValue({
        kind: 'department',
        departmentIds: [2],
      });
      repository.findById.mockResolvedValue(makeRequest({ recordedBy: 99 }));

      const error = await captureError(() =>
        service.update(33, { endDate: '2026-05-05' }, managerUser),
      );

      expect(error).toEqual({ status: 403, code: 'FORBIDDEN' });
    });
  });

  describe('remove', () => {
    it('gives back the hold of a pending request', async () => {
      balance = makeBalance({ pendingDays: '5.0' });

      const result = await service.remove(33, hrUser);

      expect(balance?.pendingDays).toBe('0.0');
      expect(result.deleted).toBe(true);
      expect(deletions).toContainEqual({
        entity: LeaveRequest,
        criteria: { id: 33 },
      });
    });

    it('gives back the used days of an approved request', async () => {
      repository.findById.mockResolvedValue(
        makeRequest({ status: LeaveRequestStatus.APPROVED }),
      );
      balance = makeBalance({ usedDays: '5.0' });

      await service.remove(33, hrUser);

      expect(balance?.usedDays).toBe('0.0');
    });

    /*
     * FK là ON DELETE SET NULL: xoá đơn suông sẽ để lại những dòng `leave` mồ
     * côi, người xem bảng công thấy nghỉ phép mà không tra ra được theo đơn nào.
     */
    it('removes the attendance days the approval had written', async () => {
      repository.findById.mockResolvedValue(
        makeRequest({ status: LeaveRequestStatus.APPROVED }),
      );
      attendanceRows = [
        { id: 1, status: AttendanceStatus.LEAVE } as Attendance,
        { id: 2, status: AttendanceStatus.LEAVE } as Attendance,
      ];

      const result = await service.remove(33, hrUser);

      expect(result.attendanceDaysRemoved).toBe(2);
      expect(result.attendanceDaysKept).toBe(0);
      expect(deletions).toContainEqual({
        entity: Attendance,
        criteria: [1, 2],
      });
    });

    /*
     * Dòng đã bị đổi khỏi `leave` là ngày công THẬT — nhập tay hoặc nạp từ máy
     * chấm công đè lên. Xoá đi là mất dữ liệu không lấy lại được.
     */
    it('keeps attendance rows that were changed away from leave', async () => {
      repository.findById.mockResolvedValue(
        makeRequest({ status: LeaveRequestStatus.APPROVED }),
      );
      attendanceRows = [
        { id: 1, status: AttendanceStatus.LEAVE } as Attendance,
        { id: 2, status: AttendanceStatus.PRESENT } as Attendance,
      ];

      const result = await service.remove(33, hrUser);

      expect(result.attendanceDaysRemoved).toBe(1);
      expect(result.attendanceDaysKept).toBe(1);
      expect(deletions).toContainEqual({ entity: Attendance, criteria: [1] });
    });

    /*
     * Quỹ đã được trả lại lúc chuyển sang `rejected`. Trả lần nữa là cấp không
     * cho nhân viên thêm mấy ngày phép.
     */
    it('does not touch the balance of a rejected request', async () => {
      repository.findById.mockResolvedValue(
        makeRequest({ status: LeaveRequestStatus.REJECTED }),
      );
      balance = makeBalance({ pendingDays: '0.0', usedDays: '3.0' });

      await service.remove(33, hrUser);

      expect(balance?.pendingDays).toBe('0.0');
      expect(balance?.usedDays).toBe('3.0');
    });

    it('lets the recorder delete their own pending request', async () => {
      employeesService.resolveScope.mockResolvedValue({
        kind: 'department',
        departmentIds: [2],
      });

      const result = await service.remove(33, managerUser);

      expect(result.deleted).toBe(true);
    });

    /*
     * Xoá một đơn đã duyệt là đảo ngược quyết định của nhân sự, kèm hoàn quỹ
     * phép. Quản lý ghi nhận không làm việc đó, kể cả với đơn chính mình nhập.
     */
    it('refuses a manager deleting an approved request', async () => {
      employeesService.resolveScope.mockResolvedValue({
        kind: 'department',
        departmentIds: [2],
      });
      repository.findById.mockResolvedValue(
        makeRequest({ status: LeaveRequestStatus.APPROVED }),
      );

      const error = await captureError(() => service.remove(33, managerUser));

      expect(error).toEqual({ status: 403, code: 'FORBIDDEN' });
    });
  });

  describe('calendar', () => {
    it('limits a manager to their own departments', async () => {
      employeesService.resolveScope.mockResolvedValue({
        kind: 'department',
        departmentIds: [2, 3],
      });

      await service.calendar('2026-05-01', '2026-05-31', managerUser);

      expect(repository.findApprovedInRange).toHaveBeenCalledWith(
        '2026-05-01',
        '2026-05-31',
        [2, 3],
      );
    });
  });
});
