import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OVERTIME_LIMITS } from '@/common/constants/attendance.constant';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { EmployeesService } from '@/modules/employees/employees.service';
import { Employee } from '@/modules/employees/entities/employee.entity';
import { HolidaysService } from '@/modules/system/holidays.service';
import { CreateOvertimeDto } from './dto/create-overtime.dto';
import {
  OvertimeRateType,
  OvertimeRequest,
  OvertimeRequestStatus,
} from './entities/overtime-request.entity';
import { OvertimeRepository } from './overtime.repository';
import { OvertimeService } from './overtime.service';

/* 2026-05-25 là thứ Hai, 2026-05-30 thứ Bảy. */
const MONDAY = '2026-05-25';
const SATURDAY = '2026-05-30';

/** Nhân viên được hưởng giờ làm thêm — người này KHÔNG đăng nhập hệ thống. */
const SUBJECT_EMPLOYEE_ID = 51;

function makeRequest(
  overrides: Partial<OvertimeRequest> = {},
): OvertimeRequest {
  return {
    id: 77,
    employeeId: SUBJECT_EMPLOYEE_ID,
    employee: {
      id: SUBJECT_EMPLOYEE_ID,
      employeeCode: 'NV0051',
      fullName: 'Nguyễn Văn Bình',
      departmentId: 2,
    } as Employee,
    workDate: MONDAY,
    startTime: '18:00:00',
    endTime: '21:00:00',
    totalHours: '3.00',
    nightHours: '0.00',
    rateType: OvertimeRateType.WEEKDAY,
    rate: '1.5',
    nightRateSurcharge: '0.0',
    reason: 'Xử lý sự cố hệ thống thanh toán',
    recordedBy: 12,
    recorder: null,
    status: OvertimeRequestStatus.PENDING,
    approvedBy: null,
    approver: null,
    approvedAt: null,
    rejectedReason: null,
    createdAt: new Date('2026-05-20T02:00:00.000Z'),
    updatedAt: new Date('2026-05-20T02:00:00.000Z'),
    ...overrides,
  };
}

function makeDto(
  overrides: Partial<CreateOvertimeDto> = {},
): CreateOvertimeDto {
  return {
    employeeId: SUBJECT_EMPLOYEE_ID,
    workDate: MONDAY,
    startTime: '18:00',
    endTime: '21:00',
    reason: 'Xử lý sự cố hệ thống thanh toán',
    ...overrides,
  };
}

/** Trưởng phòng — GHI NHẬN giờ làm thêm cho nhân viên phòng mình. */
const managerUser: AuthenticatedUser = {
  userId: 4,
  username: 'manager',
  role: 'manager',
  employeeId: 12,
  sessionId: 1,
};

/** Nhân sự / kế toán — DUYỆT. */
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

describe('OvertimeService', () => {
  let module: TestingModule;
  let service: OvertimeService;
  let repository: jest.Mocked<OvertimeRepository>;
  let employeesService: jest.Mocked<EmployeesService>;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        OvertimeService,
        {
          provide: OvertimeRepository,
          useValue: {
            findPaginated: jest.fn().mockResolvedValue([[], 0]),
            findById: jest.fn().mockResolvedValue(makeRequest()),
            findActiveByEmployeeAndDate: jest.fn().mockResolvedValue([]),
            findActiveByEmployeeInRange: jest.fn().mockResolvedValue([]),
            sumApprovedHours: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(makeRequest()),
            save: jest.fn((request: OvertimeRequest) =>
              Promise.resolve(request),
            ),
          },
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
      ],
    }).compile();

    service = module.get(OvertimeService);
    repository = module.get(OvertimeRepository);
    employeesService = module.get(EmployeesService);
  });

  describe('create – quản lý ghi nhận cho nhân viên', () => {
    /*
     * Nhân viên không đăng nhập hệ thống này, nên đơn luôn được ghi CHO một
     * người khác. `recorded_by` lấy từ token của người ghi, không lấy từ body —
     * nếu không thì ai cũng ghi hộ dưới tên người khác được.
     */
    it('stores the recorder from the token, not from the payload', async () => {
      await service.create(managerUser, makeDto());

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: SUBJECT_EMPLOYEE_ID,
          recordedBy: managerUser.employeeId,
          status: OvertimeRequestStatus.PENDING,
        }),
      );
    });

    /* Số giờ và hệ số do SERVER suy ra — client không gửi lên được. */
    it('derives hours and the Article 98 rate from the date and time span', async () => {
      await service.create(managerUser, makeDto());

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          totalHours: '3.00',
          rateType: OvertimeRateType.WEEKDAY,
          rate: '1.5',
        }),
      );
    });

    it('uses the weekend rate on a Saturday', async () => {
      await service.create(managerUser, makeDto({ workDate: SATURDAY }));

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rateType: OvertimeRateType.WEEKEND,
          rate: '2.0',
        }),
      );
    });

    it('uses the holiday rate when the date is a public holiday', async () => {
      const holidays = module.get<HolidaysService>(HolidaysService);
      jest
        .spyOn(holidays, 'findByYear')
        .mockResolvedValue([{ holidayDate: MONDAY }] as Awaited<
          ReturnType<HolidaysService['findByYear']>
        >);

      await service.create(managerUser, makeDto());

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rateType: OvertimeRateType.HOLIDAY,
          rate: '3.0',
        }),
      );
    });

    it('records the night portion of a shift running past 22:00', async () => {
      await service.create(
        managerUser,
        makeDto({ startTime: '20:00', endTime: '23:00' }),
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nightHours: '1.00',
          nightRateSurcharge: '0.3',
        }),
      );
    });

    /*
     * Trưởng phòng chỉ ghi được cho người trong phòng mình. `resolveScope` là
     * nguồn duy nhất trả lời "phòng mình gồm những ai", nên nó được uỷ quyền
     * qua `EmployeesService.findOne` thay vì so sánh phòng ban tại chỗ.
     */
    it('checks the subject is within the recorder scope', async () => {
      await service.create(managerUser, makeDto());

      expect(employeesService.findOne).toHaveBeenCalledWith(
        SUBJECT_EMPLOYEE_ID,
        managerUser,
      );
    });

    it('refuses a role that cannot record overtime at all', async () => {
      const error = await captureError(() =>
        service.create({ ...managerUser, role: 'employee' }, makeDto()),
      );

      expect(error).toEqual({ status: 403, code: 'FORBIDDEN' });
      expect(repository.create).not.toHaveBeenCalled();
    });

    /* Hai đơn chồng giờ nghĩa là cùng một giờ đồng hồ được trả tiền hai lần. */
    it('rejects a span overlapping an active request', async () => {
      repository.findActiveByEmployeeAndDate.mockResolvedValue([
        makeRequest({ startTime: '19:00:00', endTime: '22:00:00' }),
      ]);

      const error = await captureError(() =>
        service.create(managerUser, makeDto()),
      );

      expect(error).toEqual({ status: 409, code: 'OVERLAPPING_OVERTIME' });
    });

    it('allows a second block that only touches the first at the boundary', async () => {
      repository.findActiveByEmployeeAndDate.mockResolvedValue([
        makeRequest({ startTime: '21:00:00', endTime: '22:00:00' }),
      ]);

      await expect(
        service.create(managerUser, makeDto()),
      ).resolves.toBeDefined();
    });

    describe('trần Điều 107 BLLĐ 2019', () => {
      /*
       * Trần ngày là TỔNG giờ có mặt: ngày thường đã có 8 giờ ca chính nên chỉ
       * còn 4 giờ làm thêm. Hiểu nhầm thành "12 giờ làm thêm" là cho phép một
       * ngày làm 20 tiếng.
       */
      it('caps a weekday at 4 overtime hours on top of the standard 8', async () => {
        const error = await captureError(() =>
          service.create(
            managerUser,
            makeDto({ startTime: '17:00', endTime: '22:00' }),
          ),
        );

        expect(error).toEqual({
          status: 422,
          code: 'OVERTIME_DAILY_LIMIT_EXCEEDED',
        });
      });

      it('accepts exactly 4 overtime hours on a weekday', async () => {
        await expect(
          service.create(
            managerUser,
            makeDto({ startTime: '17:00', endTime: '21:00' }),
          ),
        ).resolves.toBeDefined();
      });

      /* Ngày nghỉ không có ca chính nên được trọn 12 giờ. */
      it('allows up to 12 hours on a Saturday, which has no standard shift', async () => {
        await expect(
          service.create(
            managerUser,
            makeDto({
              workDate: SATURDAY,
              startTime: '08:00',
              endTime: '20:00',
            }),
          ),
        ).resolves.toBeDefined();
      });

      it('rejects more than 12 hours even on a Saturday', async () => {
        const error = await captureError(() =>
          service.create(
            managerUser,
            makeDto({
              workDate: SATURDAY,
              startTime: '08:00',
              endTime: '21:00',
            }),
          ),
        );

        expect(error).toEqual({
          status: 422,
          code: 'OVERTIME_DAILY_LIMIT_EXCEEDED',
        });
      });

      it('rejects a request that would pass the 40-hour monthly cap', async () => {
        repository.findActiveByEmployeeInRange.mockImplementation(
          (_employeeId: number, from: string) =>
            Promise.resolve(
              // Chỉ trả về khi hỏi cả tháng, không phải khi hỏi một ngày.
              from.endsWith('-01')
                ? [makeRequest({ id: 1, totalHours: '38.00' })]
                : [],
            ),
        );

        const error = await captureError(() =>
          service.create(managerUser, makeDto()),
        );

        expect(error).toEqual({
          status: 422,
          code: 'OVERTIME_MONTHLY_LIMIT_EXCEEDED',
        });
      });

      it('rejects a request that would pass the 200-hour yearly cap', async () => {
        repository.findActiveByEmployeeInRange.mockImplementation(
          (_employeeId: number, from: string) =>
            Promise.resolve(
              from === '2026-01-01'
                ? [makeRequest({ id: 1, totalHours: '199.00' })]
                : [],
            ),
        );

        const error = await captureError(() =>
          service.create(managerUser, makeDto()),
        );

        expect(error).toEqual({
          status: 422,
          code: 'OVERTIME_YEARLY_LIMIT_EXCEEDED',
        });
      });

      it('keeps the caps in sync with the documented Article 107 figures', () => {
        expect(OVERTIME_LIMITS.MAX_TOTAL_HOURS_PER_DAY).toBe(12);
        expect(OVERTIME_LIMITS.MAX_HOURS_PER_MONTH).toBe(40);
        expect(OVERTIME_LIMITS.MAX_HOURS_PER_YEAR).toBe(200);
      });
    });
  });

  describe('approve – kế toán/nhân sự duyệt', () => {
    it('lets HR approve a request recorded by someone else', async () => {
      const result = await service.approve(77, hrUser);

      expect(result.status).toBe(OvertimeRequestStatus.APPROVED);
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: OvertimeRequestStatus.APPROVED,
          approvedBy: hrUser.employeeId,
        }),
      );
    });

    /*
     * Trưởng phòng GHI NHẬN nhưng KHÔNG duyệt. Giờ làm thêm là tiền ra khỏi
     * công ty, và bước duyệt là lớp kiểm soát duy nhất trước bảng lương — để
     * cùng một người vừa nhập vừa duyệt thì lớp đó chỉ còn là một cái nút.
     */
    it('refuses a manager, who records but does not approve', async () => {
      const error = await captureError(() => service.approve(77, managerUser));

      expect(error).toEqual({ status: 403, code: 'FORBIDDEN' });
      expect(repository.save).not.toHaveBeenCalled();
    });

    /* Nhân sự tự nhập rồi tự duyệt thì bước duyệt không kiểm tra được gì. */
    it('refuses the person who recorded the request, even though HR may approve', async () => {
      repository.findById.mockResolvedValue(
        makeRequest({ recordedBy: hrUser.employeeId }),
      );

      const error = await captureError(() => service.approve(77, hrUser));

      expect(error).toEqual({ status: 403, code: 'CANNOT_APPROVE_OWN_RECORD' });
    });

    /*
     * Đơn cũ (tạo trước khi có cột `recorded_by`) không biết ai nhập. Chặn tất
     * cả sẽ khiến dữ liệu cũ kẹt vĩnh viễn ở trạng thái chờ.
     */
    it('allows approval when the recorder is unknown on a legacy row', async () => {
      repository.findById.mockResolvedValue(makeRequest({ recordedBy: null }));

      await expect(service.approve(77, hrUser)).resolves.toBeDefined();
    });

    it('refuses to approve a request that is no longer pending', async () => {
      repository.findById.mockResolvedValue(
        makeRequest({ status: OvertimeRequestStatus.APPROVED }),
      );

      const error = await captureError(() => service.approve(77, hrUser));

      expect(error).toEqual({ status: 409, code: 'OVERTIME_NOT_PENDING' });
    });

    /*
     * Trần được kiểm LẠI lúc duyệt, và đơn đang duyệt phải bị trừ ra khỏi tổng
     * — nếu không nó tự cộng chính mình hai lần và mọi đơn sát trần đều hỏng.
     */
    it('excludes the request being approved from its own cap total', async () => {
      repository.findActiveByEmployeeInRange.mockResolvedValue([
        makeRequest({ id: 77, totalHours: '3.00' }),
      ]);

      await expect(service.approve(77, hrUser)).resolves.toBeDefined();
    });

    it('blocks approval when other requests have since filled the monthly cap', async () => {
      repository.findActiveByEmployeeInRange.mockImplementation(
        (_employeeId: number, from: string) =>
          Promise.resolve(
            from.endsWith('-01')
              ? [
                  makeRequest({ id: 77, totalHours: '3.00' }),
                  makeRequest({ id: 88, totalHours: '38.00' }),
                ]
              : [],
          ),
      );

      const error = await captureError(() => service.approve(77, hrUser));

      expect(error).toEqual({
        status: 422,
        code: 'OVERTIME_MONTHLY_LIMIT_EXCEEDED',
      });
    });
  });

  describe('reject', () => {
    it('stores the reason so the recorder knows what to fix', async () => {
      const result = await service.reject(
        77,
        { reason: 'Đã vượt trần 40 giờ trong tháng' },
        hrUser,
      );

      expect(result.status).toBe(OvertimeRequestStatus.REJECTED);
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          rejectedReason: 'Đã vượt trần 40 giờ trong tháng',
        }),
      );
    });

    it('refuses a manager here too', async () => {
      const error = await captureError(() =>
        service.reject(77, { reason: 'Không duyệt' }, managerUser),
      );

      expect(error).toEqual({ status: 403, code: 'FORBIDDEN' });
    });
  });

  describe('cancel – người ghi rút lại đơn mình nhập', () => {
    it('lets the recorder withdraw their own pending entry', async () => {
      employeesService.resolveScope.mockResolvedValue({
        kind: 'department',
        departmentIds: [2],
      });

      const result = await service.cancel(77, managerUser);

      expect(result.status).toBe(OvertimeRequestStatus.CANCELLED);
    });

    /* Nhân sự dọn được đơn của người khác — quản lý nhập nhầm rồi đi nghỉ phép. */
    it('lets HR withdraw an entry recorded by someone else', async () => {
      await expect(service.cancel(77, hrUser)).resolves.toBeDefined();
    });

    it('refuses a manager who did not record the entry', async () => {
      employeesService.resolveScope.mockResolvedValue({
        kind: 'department',
        departmentIds: [2],
      });
      repository.findById.mockResolvedValue(makeRequest({ recordedBy: 999 }));

      const error = await captureError(() => service.cancel(77, managerUser));

      expect(error).toEqual({ status: 403, code: 'FORBIDDEN' });
    });

    /*
     * Đơn đã duyệt là một khoản đã vào diện chi trả; gỡ nó lặng lẽ thì không
     * còn dấu vết ai đã duyệt cái gì.
     */
    it('refuses to withdraw an entry that was already approved', async () => {
      repository.findById.mockResolvedValue(
        makeRequest({ status: OvertimeRequestStatus.APPROVED }),
      );

      const error = await captureError(() => service.cancel(77, hrUser));

      expect(error).toEqual({ status: 409, code: 'OVERTIME_NOT_PENDING' });
    });
  });

  describe('findAll', () => {
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

    it('lets HR filter by any employee', async () => {
      await service.findAll({ employeeId: 999 }, hrUser);

      expect(repository.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: 999 }),
      );
    });
  });
});
