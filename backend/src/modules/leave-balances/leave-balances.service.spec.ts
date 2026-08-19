import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { EmployeesRepository } from '@/modules/employees/employees.repository';
import { EmployeesService } from '@/modules/employees/employees.service';
import { LeaveType } from '@/modules/leaves/entities/leave-type.entity';
import { LeaveTypesRepository } from '@/modules/leaves/leave-types.repository';
import { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveBalancesRepository } from './leave-balances.repository';
import { LeaveBalancesService } from './leave-balances.service';

function makeBalance(overrides: Partial<LeaveBalance> = {}): LeaveBalance {
  return {
    id: 88,
    employeeId: 51,
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

/** Nhân sự — phạm vi `all`, được quản quỹ phép. */
const hrUser: AuthenticatedUser = {
  userId: 2,
  username: 'hr.manager',
  role: 'hr_manager',
  employeeId: 2,
  sessionId: 1,
};

/** Trưởng phòng — đọc được quỹ phòng mình nhưng KHÔNG cấp, KHÔNG sửa, KHÔNG xoá. */
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

describe('LeaveBalancesService', () => {
  let module: TestingModule;
  let service: LeaveBalancesService;
  let repository: jest.Mocked<LeaveBalancesRepository>;
  let employeesService: jest.Mocked<EmployeesService>;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        LeaveBalancesService,
        {
          provide: LeaveBalancesRepository,
          useValue: {
            findPaginated: jest.fn().mockResolvedValue([[], 0]),
            findById: jest.fn().mockResolvedValue(makeBalance()),
            findOneFor: jest.fn().mockResolvedValue(null),
            createMany: jest.fn().mockResolvedValue([]),
            remove: jest.fn().mockResolvedValue({ affected: 1 }),
            save: jest.fn((balance: LeaveBalance) => Promise.resolve(balance)),
          },
        },
        {
          provide: EmployeesRepository,
          useValue: { findActiveForAllocation: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: EmployeesService,
          useValue: {
            resolveScope: jest.fn().mockResolvedValue({ kind: 'all' }),
          },
        },
        {
          provide: LeaveTypesRepository,
          useValue: {
            findByCode: jest
              .fn()
              .mockResolvedValue({ id: 1, code: 'ANNUAL' } as LeaveType),
          },
        },
      ],
    }).compile();

    service = module.get(LeaveBalancesService);
    repository = module.get(LeaveBalancesRepository);
    employeesService = module.get(EmployeesService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('remove', () => {
    it('deletes a balance nobody has drawn on', async () => {
      const result = await service.remove(88, hrUser);

      expect(repository.remove).toHaveBeenCalledWith(88);
      expect(result).toEqual({ id: 88, deleted: true });
    });

    /*
     * Xoá một dòng quỹ đã có đơn trừ vào sẽ bỏ rơi chính những đơn đó: ngày nghỉ
     * vẫn nằm trong bảng chấm công mà không còn gì giải thích chúng đến từ đâu.
     */
    it('refuses to delete a balance with used days', async () => {
      repository.findById.mockResolvedValue(makeBalance({ usedDays: '3.0' }));

      const error = await captureError(() => service.remove(88, hrUser));

      expect(error).toEqual({ status: 422, code: 'LEAVE_BALANCE_IN_USE' });
      expect(repository.remove).not.toHaveBeenCalled();
    });

    it('refuses to delete a balance holding pending days', async () => {
      repository.findById.mockResolvedValue(makeBalance({ pendingDays: '0.5' }));

      const error = await captureError(() => service.remove(88, hrUser));

      expect(error).toEqual({ status: 422, code: 'LEAVE_BALANCE_IN_USE' });
    });

    it('refuses a manager deleting a balance', async () => {
      employeesService.resolveScope.mockResolvedValue({
        kind: 'department',
        departmentIds: [2],
      });

      const error = await captureError(() => service.remove(88, managerUser));

      expect(error).toEqual({ status: 403, code: 'FORBIDDEN' });
      expect(repository.remove).not.toHaveBeenCalled();
    });

    it('reports a missing balance instead of reporting success', async () => {
      repository.findById.mockResolvedValue(null);

      const error = await captureError(() => service.remove(404, hrUser));

      expect(error).toEqual({ status: 404, code: 'LEAVE_BALANCE_NOT_FOUND' });
    });
  });

  describe('adjust', () => {
    /*
     * Quỹ không được hạ xuống dưới phần ĐÃ cam kết — nếu không thì
     * `remaining_days` (cột VIRTUAL) rơi xuống số âm.
     */
    it('refuses to set the balance below what is already committed', async () => {
      repository.findById.mockResolvedValue(
        makeBalance({ usedDays: '5.0', pendingDays: '2.0' }),
      );

      const error = await captureError(() =>
        service.adjust(88, { allocatedDays: 6, reason: 'Cấp nhầm' }, hrUser),
      );

      expect(error).toEqual({
        status: 422,
        code: 'LEAVE_BALANCE_BELOW_COMMITTED',
      });
    });

    it('allows lowering the balance down to exactly what is committed', async () => {
      repository.findById.mockResolvedValue(
        makeBalance({ usedDays: '5.0', pendingDays: '2.0' }),
      );

      await service.adjust(88, { allocatedDays: 7, reason: 'Cấp nhầm' }, hrUser);

      expect(repository.save).toHaveBeenCalled();
    });

    it('refuses a manager adjusting a balance', async () => {
      employeesService.resolveScope.mockResolvedValue({
        kind: 'department',
        departmentIds: [2],
      });

      const error = await captureError(() =>
        service.adjust(88, { allocatedDays: 15, reason: 'Thêm' }, managerUser),
      );

      expect(error).toEqual({ status: 403, code: 'FORBIDDEN' });
    });
  });
});
