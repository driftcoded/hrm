import { ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { EmployeesService } from '@/modules/employees/employees.service';
import { Employee } from '@/modules/employees/entities/employee.entity';
import { DependentsRepository } from './dependents.repository';
import { DependentsService } from './dependents.service';
import {
  Dependent,
  DependentRelationship,
  DependentStatus,
} from './entities/dependent.entity';

function makeDependent(overrides: Partial<Dependent> = {}): Dependent {
  return {
    id: 1,
    employeeId: 51,
    employee: undefined,
    fullName: 'Nguyễn Thị Mẹ',
    relationship: DependentRelationship.PARENT,
    dateOfBirth: '1960-04-15',
    cccdNumber: null,
    taxCode: null,
    registrationDate: '2026-01-01',
    endDate: null,
    status: DependentStatus.ACTIVE,
    reasonInactive: null,
    documentUrl: null,
    note: null,
    createdAt: new Date('2026-08-19T02:00:00.000Z'),
    updatedAt: new Date('2026-08-19T02:00:00.000Z'),
    ...overrides,
  } as Dependent;
}

const hrUser: AuthenticatedUser = {
  userId: 3,
  username: 'hr.staff',
  role: 'hr_staff',
  employeeId: 3,
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

describe('DependentsService', () => {
  let service: DependentsService;
  let repository: jest.Mocked<DependentsRepository>;
  let employeesService: jest.Mocked<EmployeesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DependentsService,
        {
          provide: DependentsRepository,
          useValue: {
            findByEmployee: jest.fn().mockResolvedValue([makeDependent()]),
            findById: jest.fn().mockResolvedValue(makeDependent()),
            findActiveDuplicate: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(makeDependent({ id: 2 })),
            update: jest.fn().mockResolvedValue(undefined),
            remove: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: EmployeesService,
          useValue: { findOne: jest.fn().mockResolvedValue({ id: 51 }) },
        },
      ],
    }).compile();

    service = module.get(DependentsService);
    repository = module.get(DependentsRepository);
    employeesService = module.get(EmployeesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const validPayload = {
    fullName: 'Nguyễn Thị Mẹ',
    relationship: DependentRelationship.PARENT,
    dateOfBirth: '1960-04-15',
    registrationDate: '2026-01-01',
  };

  // ------------------------------------------------------------- findAll ---

  describe('findAll', () => {
    it('kiểm tra quyền trên hồ sơ nhân viên trước khi trả dữ liệu', async () => {
      await service.findAll(51, hrUser);

      expect(employeesService.findOne).toHaveBeenCalledWith(51, hrUser);
    });

    it('không có quyền trên hồ sơ nhân viên → lỗi đẩy lên nguyên vẹn', async () => {
      employeesService.findOne.mockRejectedValue(
        new ForbiddenException({ code: 'FORBIDDEN', message: 'nope' }),
      );

      const error = await captureError(() => service.findAll(51, hrUser));

      expect(error).toEqual({
        status: HttpStatus.FORBIDDEN,
        code: 'FORBIDDEN',
      });
      expect(repository.findByEmployee).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------- create ---

  describe('create', () => {
    it('gắn employeeId từ URL và mặc định status = active', async () => {
      await service.create(51, validPayload, hrUser);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: 51,
          status: DependentStatus.ACTIVE,
        }),
      );
    });

    it('trùng CCCD với người phụ thuộc đang hiệu lực của NV khác → 409', async () => {
      repository.findActiveDuplicate.mockResolvedValue(
        makeDependent({
          id: 9,
          employeeId: 77,
          employee: { id: 77, employeeCode: 'NV0077' } as Employee,
        }),
      );

      const error = await captureError(() =>
        service.create(
          51,
          { ...validPayload, cccdNumber: '001060000001' },
          hrUser,
        ),
      );

      expect(error).toEqual({
        status: HttpStatus.CONFLICT,
        code: 'DEPENDENT_ALREADY_CLAIMED',
      });
    });

    it('message của lỗi trùng nêu rõ nhân viên nào đang khai', async () => {
      repository.findActiveDuplicate.mockResolvedValue(
        makeDependent({
          id: 9,
          employeeId: 77,
          employee: { id: 77, employeeCode: 'NV0077' } as Employee,
        }),
      );

      await expect(
        service.create(51, { ...validPayload, taxCode: '8901234560' }, hrUser),
      ).rejects.toThrow(/NV0077/);
    });

    it('KHÔNG kiểm tra trùng khi không có CCCD lẫn MST', async () => {
      await service.create(51, validPayload, hrUser);

      expect(repository.findActiveDuplicate).not.toHaveBeenCalled();
    });

    it('endDate trước registrationDate → 422 INVALID_DATE_RANGE', async () => {
      const error = await captureError(() =>
        service.create(51, { ...validPayload, endDate: '2025-01-01' }, hrUser),
      );

      expect(error).toEqual({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        code: 'INVALID_DATE_RANGE',
      });
    });

    it('đăng ký trước cả ngày sinh → 422 INVALID_DATE_RANGE', async () => {
      const error = await captureError(() =>
        service.create(
          51,
          { ...validPayload, dateOfBirth: '2027-01-01' },
          hrUser,
        ),
      );

      expect(error.code).toBe('INVALID_DATE_RANGE');
    });
  });

  // -------------------------------------------------------------- update ---

  describe('update', () => {
    it('chuyển sang inactive mà thiếu lý do → 422 DEPENDENT_REASON_REQUIRED', async () => {
      const error = await captureError(() =>
        service.update(51, 1, { status: DependentStatus.INACTIVE }, hrUser),
      );

      expect(error).toEqual({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        code: 'DEPENDENT_REASON_REQUIRED',
      });
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('chuyển sang inactive kèm lý do → lưu cả hai', async () => {
      await service.update(
        51,
        1,
        {
          status: DependentStatus.INACTIVE,
          reasonInactive: 'Đã có thu nhập',
        },
        hrUser,
      );

      expect(repository.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: DependentStatus.INACTIVE,
          reasonInactive: 'Đã có thu nhập',
        }),
      );
    });

    it('bật lại active thì xoá lý do ngừng cũ', async () => {
      repository.findById.mockResolvedValue(
        makeDependent({
          status: DependentStatus.INACTIVE,
          reasonInactive: 'Đã có thu nhập',
        }),
      );

      await service.update(51, 1, { status: DependentStatus.ACTIVE }, hrUser);

      expect(repository.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: DependentStatus.ACTIVE,
          reasonInactive: null,
        }),
      );
    });

    it('bản ghi inactive KHÔNG bị kiểm tra trùng (không còn chiếm suất)', async () => {
      repository.findById.mockResolvedValue(
        makeDependent({
          status: DependentStatus.INACTIVE,
          reasonInactive: 'cũ',
          cccdNumber: '001060000001',
        }),
      );

      await service.update(51, 1, { note: 'ghi chú' }, hrUser);

      expect(repository.findActiveDuplicate).not.toHaveBeenCalled();
    });

    it('bản ghi thuộc nhân viên khác → 404, KHÔNG sửa (chống IDOR)', async () => {
      repository.findById.mockResolvedValue(makeDependent({ employeeId: 99 }));

      const error = await captureError(() =>
        service.update(51, 1, { note: 'x' }, hrUser),
      );

      expect(error).toEqual({
        status: HttpStatus.NOT_FOUND,
        code: 'DEPENDENT_NOT_FOUND',
      });
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------- remove ---

  describe('remove', () => {
    it('xoá bản ghi thuộc đúng nhân viên', async () => {
      const result = await service.remove(51, 1, hrUser);

      expect(repository.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual({ id: 1, deleted: true });
    });

    it('bản ghi thuộc nhân viên khác → 404, KHÔNG xoá (chống IDOR)', async () => {
      repository.findById.mockResolvedValue(makeDependent({ employeeId: 99 }));

      const error = await captureError(() => service.remove(51, 1, hrUser));

      expect(error.code).toBe('DEPENDENT_NOT_FOUND');
      expect(repository.remove).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------- isCurrentlyDeductible ------

  describe('isCurrentlyDeductible', () => {
    it('active, đã qua ngày đăng ký, chưa có endDate → true', async () => {
      repository.findByEmployee.mockResolvedValue([
        makeDependent({ registrationDate: '2020-01-01', endDate: null }),
      ]);

      const [dependent] = await service.findAll(51, hrUser);

      expect(dependent.isCurrentlyDeductible).toBe(true);
    });

    it('inactive → false dù còn trong khoảng ngày', async () => {
      repository.findByEmployee.mockResolvedValue([
        makeDependent({
          registrationDate: '2020-01-01',
          status: DependentStatus.INACTIVE,
          reasonInactive: 'Đã có thu nhập',
        }),
      ]);

      const [dependent] = await service.findAll(51, hrUser);

      expect(dependent.isCurrentlyDeductible).toBe(false);
    });

    it('endDate đã qua → false', async () => {
      repository.findByEmployee.mockResolvedValue([
        makeDependent({
          registrationDate: '2020-01-01',
          endDate: '2020-12-31',
        }),
      ]);

      const [dependent] = await service.findAll(51, hrUser);

      expect(dependent.isCurrentlyDeductible).toBe(false);
    });

    it('ngày đăng ký còn ở tương lai → false', async () => {
      repository.findByEmployee.mockResolvedValue([
        makeDependent({ registrationDate: '2099-01-01' }),
      ]);

      const [dependent] = await service.findAll(51, hrUser);

      expect(dependent.isCurrentlyDeductible).toBe(false);
    });
  });
});
