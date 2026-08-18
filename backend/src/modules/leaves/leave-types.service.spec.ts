import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LeaveApplicableGender, LeaveType } from './entities/leave-type.entity';
import { LeaveTypesRepository } from './leave-types.repository';
import { LeaveTypesService } from './leave-types.service';

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
    advanceNoticeDays: 3,
    applicableGender: LeaveApplicableGender.ALL,
    description: 'Điều 113 BLLĐ 2019',
    isActive: true,
    sortOrder: 1,
    isSystem: false,
    ...overrides,
  };
}

describe('LeaveTypesService', () => {
  let service: LeaveTypesService;
  let repository: jest.Mocked<LeaveTypesRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveTypesService,
        {
          provide: LeaveTypesRepository,
          useValue: {
            findAll: jest.fn().mockResolvedValue([]),
            findById: jest.fn(),
            findByCode: jest.fn().mockResolvedValue(null),
            countLeaveRequests: jest.fn().mockResolvedValue(0),
            countLeaveBalances: jest.fn().mockResolvedValue(0),
            create: jest.fn(),
            update: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(LeaveTypesService);
    repository = module.get(LeaveTypesRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns an array (no pagination) and converts DECIMAL columns to numbers', async () => {
      repository.findAll.mockResolvedValue([makeLeaveType()]);

      const result = await service.findAll({});

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toMatchObject({
        code: 'ANNUAL',
        daysPerYear: 12,
        minDays: 0.5,
        maxConsecutive: null,
        applicableGender: LeaveApplicableGender.ALL,
      });
    });

    it('passes the isActive/applicableGender filter down to the repository', async () => {
      await service.findAll({
        isActive: true,
        applicableGender: LeaveApplicableGender.FEMALE,
      });

      expect(repository.findAll).toHaveBeenCalledWith({
        isActive: true,
        applicableGender: LeaveApplicableGender.FEMALE,
      });
    });
  });

  describe('create', () => {
    it('defaults isPaid/requireApproval/minDays/advanceNoticeDays per schema §5.2', async () => {
      repository.create.mockResolvedValue(makeLeaveType({ id: 10 }));
      repository.findById.mockResolvedValue(makeLeaveType({ id: 10 }));

      await service.create({ code: 'study', name: 'Nghỉ học', daysPerYear: 5 });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'STUDY',
          daysPerYear: '5.0',
          isPaid: true,
          requireApproval: true,
          minDays: '0.5',
          advanceNoticeDays: 1,
          applicableGender: LeaveApplicableGender.ALL,
          maxConsecutive: null,
          sortOrder: 0,
        }),
      );
    });

    it('duplicate code → 409 DUPLICATE_LEAVE_TYPE_CODE', async () => {
      repository.findByCode.mockResolvedValue(makeLeaveType());

      await expect(
        service.create({ code: 'ANNUAL', name: 'Trùng', daysPerYear: 1 }),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'DUPLICATE_LEAVE_TYPE_CODE' },
      });
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('writes daysPerYear as a DECIMAL with 1 decimal place', async () => {
      repository.findById.mockResolvedValue(makeLeaveType({ id: 2 }));

      await service.update(2, { daysPerYear: 14 });

      expect(repository.update).toHaveBeenCalledWith(2, {
        daysPerYear: '14.0',
      });
    });

    it('non-existent id → 404 LEAVE_TYPE_NOT_FOUND', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update(99, { name: 'X' })).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'LEAVE_TYPE_NOT_FOUND' },
      });
    });

    it('explicit null on a non-nullable field → 400 VALIDATION_ERROR, no update performed', async () => {
      repository.findById.mockResolvedValue(makeLeaveType({ id: 2 }));

      await expect(
        service.update(2, { name: null } as never),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: 'VALIDATION_ERROR' },
      });
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('null on a nullable field (description) is still accepted', async () => {
      repository.findById.mockResolvedValue(makeLeaveType({ id: 2 }));

      await service.update(2, { description: null });

      expect(repository.update).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ description: null }),
      );
    });

    it('renaming the code of a statutory leave type (isSystem=true) → 403 LEAVE_TYPE_SYSTEM_LOCKED', async () => {
      repository.findById.mockResolvedValue(
        makeLeaveType({ id: 1, isSystem: true }),
      );

      await expect(
        service.update(1, { code: 'ANNUAL_LEAVE' }),
      ).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { code: 'LEAVE_TYPE_SYSTEM_LOCKED' },
      });
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('editing daysPerYear on a statutory leave type is still allowed (only code/delete are locked)', async () => {
      repository.findById.mockResolvedValue(
        makeLeaveType({ id: 1, isSystem: true }),
      );

      await service.update(1, { daysPerYear: 15 });

      expect(repository.update).toHaveBeenCalledWith(1, {
        daysPerYear: '15.0',
      });
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      repository.findById.mockResolvedValue(makeLeaveType({ id: 5 }));
    });

    it('referenced by a leave request → 422 LEAVE_TYPE_IN_USE, no delete performed', async () => {
      repository.countLeaveRequests.mockResolvedValue(2);

      await expect(service.remove(5)).rejects.toMatchObject({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        response: { code: 'LEAVE_TYPE_IN_USE' },
      });
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('referenced by a leave balance → 422 LEAVE_TYPE_IN_USE', async () => {
      repository.countLeaveBalances.mockResolvedValue(6);

      await expect(service.remove(5)).rejects.toMatchObject({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        response: { code: 'LEAVE_TYPE_IN_USE' },
      });
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('not referenced anywhere → hard delete (table has no deleted_at)', async () => {
      const result = await service.remove(5);

      expect(repository.delete).toHaveBeenCalledWith(5);
      expect(result).toEqual({ id: 5, deleted: true });
    });

    it('statutory leave type (isSystem=true) → 403 LEAVE_TYPE_SYSTEM_LOCKED, not deleted even when unused', async () => {
      repository.findById.mockResolvedValue(
        makeLeaveType({ id: 5, isSystem: true }),
      );

      await expect(service.remove(5)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { code: 'LEAVE_TYPE_SYSTEM_LOCKED' },
      });
      expect(repository.delete).not.toHaveBeenCalled();
      expect(repository.countLeaveRequests).not.toHaveBeenCalled();
    });
  });
});
