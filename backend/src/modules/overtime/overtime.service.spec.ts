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

function makeRequest(
  overrides: Partial<OvertimeRequest> = {},
): OvertimeRequest {
  return {
    id: 77,
    employeeId: 51,
    employee: {
      id: 51,
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
    workDate: MONDAY,
    startTime: '18:00',
    endTime: '21:00',
    reason: 'Xử lý sự cố hệ thống thanh toán',
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

const managerUser: AuthenticatedUser = {
  userId: 4,
  username: 'manager',
  role: 'manager',
  employeeId: 12,
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

  describe('create', () => {
    /*
     * Số giờ và hệ số phải do SERVER suy ra. Nhận từ client là cho phép khai 8
     * giờ cho một ca 2 tiếng, hoặc chọn hệ số ngày lễ cho một ngày thường.
     */
    it('derives hours and the Article 98 rate from the date and time span', async () => {
      await service.create(employeeUser, makeDto());

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          totalHours: '3.00',
          rateType: OvertimeRateType.WEEKDAY,
          rate: '1.5',
          status: OvertimeRequestStatus.PENDING,
        }),
      );
    });

    it('uses the weekend rate on a Saturday', async () => {
      await service.create(employeeUser, makeDto({ workDate: SATURDAY }));

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

      await service.create(employeeUser, makeDto());

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rateType: OvertimeRateType.HOLIDAY,
          rate: '3.0',
        }),
      );
    });

    it('records the night portion of a shift running past 22:00', async () => {
      await service.create(
        employeeUser,
        makeDto({ startTime: '20:00', endTime: '23:00' }),
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nightHours: '1.00',
          nightRateSurcharge: '0.3',
        }),
      );
    });

    /* Hai đơn chồng giờ nghĩa là cùng một giờ đồng hồ được trả tiền hai lần. */
    it('rejects a span overlapping an active request', async () => {
      repository.findActiveByEmployeeAndDate.mockResolvedValue([
        makeRequest({ startTime: '19:00:00', endTime: '22:00:00' }),
      ]);

      const error = await captureError(() =>
        service.create(employeeUser, makeDto()),
      );

      expect(error).toEqual({ status: 409, code: 'OVERLAPPING_OVERTIME' });
    });

    it('allows a second block that only touches the first at the boundary', async () => {
      repository.findActiveByEmployeeAndDate.mockResolvedValue([
        makeRequest({ startTime: '21:00:00', endTime: '22:00:00' }),
      ]);

      await expect(
        service.create(employeeUser, makeDto()),
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
            employeeUser,
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
            employeeUser,
            makeDto({ startTime: '17:00', endTime: '21:00' }),
          ),
        ).resolves.toBeDefined();
      });

      /* Ngày nghỉ không có ca chính nên được trọn 12 giờ. */
      it('allows up to 12 hours on a Saturday, which has no standard shift', async () => {
        await expect(
          service.create(
            employeeUser,
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
            employeeUser,
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
          service.create(employeeUser, makeDto()),
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
          service.create(employeeUser, makeDto()),
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

  /* PLAN 4.1: "OT: manager duyệt → trạng thái `approved`". */
  describe('approve', () => {
    beforeEach(() => {
      employeesService.resolveScope.mockResolvedValue({
        kind: 'department',
        departmentIds: [2],
      });
    });

    it('lets a manager approve a request from their own department', async () => {
      const result = await service.approve(77, managerUser);

      expect(result.status).toBe(OvertimeRequestStatus.APPROVED);
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: OvertimeRequestStatus.APPROVED,
          approvedBy: managerUser.employeeId,
        }),
      );
    });

    it('refuses a manager from another department', async () => {
      employeesService.resolveScope.mockResolvedValue({
        kind: 'department',
        departmentIds: [9],
      });

      const error = await captureError(() => service.approve(77, managerUser));

      expect(error).toEqual({ status: 403, code: 'FORBIDDEN' });
    });

    /*
     * Trưởng phòng cũng là nhân viên và cũng đăng ký làm thêm. Cho tự duyệt thì
     * cả cơ chế phê duyệt chỉ còn là một cái nút.
     */
    it('refuses anyone approving their own request, including HR', async () => {
      employeesService.resolveScope.mockResolvedValue({ kind: 'all' });
      repository.findById.mockResolvedValue(makeRequest({ employeeId: 2 }));

      const error = await captureError(() => service.approve(77, hrUser));

      expect(error).toEqual({
        status: 403,
        code: 'CANNOT_APPROVE_OWN_OVERTIME',
      });
    });

    it('refuses to approve a request that is no longer pending', async () => {
      repository.findById.mockResolvedValue(
        makeRequest({ status: OvertimeRequestStatus.APPROVED }),
      );

      const error = await captureError(() => service.approve(77, managerUser));

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

      await expect(service.approve(77, managerUser)).resolves.toBeDefined();
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

      const error = await captureError(() => service.approve(77, managerUser));

      expect(error).toEqual({
        status: 422,
        code: 'OVERTIME_MONTHLY_LIMIT_EXCEEDED',
      });
    });
  });

  describe('reject', () => {
    beforeEach(() => {
      employeesService.resolveScope.mockResolvedValue({
        kind: 'department',
        departmentIds: [2],
      });
    });

    it('stores the reason so the applicant knows what to fix', async () => {
      const result = await service.reject(
        77,
        { reason: 'Đã vượt trần 40 giờ trong tháng' },
        managerUser,
      );

      expect(result.status).toBe(OvertimeRequestStatus.REJECTED);
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          rejectedReason: 'Đã vượt trần 40 giờ trong tháng',
        }),
      );
    });
  });

  describe('cancel', () => {
    it('lets the applicant withdraw their own pending request', async () => {
      const result = await service.cancel(77, employeeUser);

      expect(result.status).toBe(OvertimeRequestStatus.CANCELLED);
    });

    it("refuses to cancel someone else's request", async () => {
      repository.findById.mockResolvedValue(makeRequest({ employeeId: 99 }));

      const error = await captureError(() => service.cancel(77, employeeUser));

      expect(error).toEqual({ status: 403, code: 'FORBIDDEN' });
    });

    /*
     * Đơn đã duyệt là thoả thuận hai bên. Rút lại một mình thì phần việc đã làm
     * theo đơn đó biến mất khỏi hồ sơ.
     */
    it('refuses to cancel a request that was already approved', async () => {
      repository.findById.mockResolvedValue(
        makeRequest({ status: OvertimeRequestStatus.APPROVED }),
      );

      const error = await captureError(() => service.cancel(77, employeeUser));

      expect(error).toEqual({ status: 409, code: 'OVERTIME_NOT_PENDING' });
    });
  });

  describe('findAll', () => {
    /*
     * Tin `?employeeId=` do client gửi thì bất kỳ ai cũng đọc được đơn của
     * người khác bằng cách đổi một con số trên URL.
     */
    it('pins a plain employee to their own id, ignoring the query parameter', async () => {
      employeesService.resolveScope.mockResolvedValue({
        kind: 'self',
        employeeId: 51,
      });

      await service.findAll({ employeeId: 999 }, employeeUser);

      expect(repository.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: 51 }),
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
