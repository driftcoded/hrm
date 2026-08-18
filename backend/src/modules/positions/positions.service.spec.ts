import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Department } from '@/modules/departments/entities/department.entity';
import { Position } from './entities/position.entity';
import { PositionsRepository } from './positions.repository';
import { PositionsService } from './positions.service';

function makeDepartment(id: number, name = 'Phòng Kỹ thuật'): Department {
  return { id, name } as Department;
}

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    id: 1,
    code: 'DEV_SENIOR',
    name: 'Developer Senior',
    departmentId: 2,
    department: makeDepartment(2),
    level: 2,
    minSalary: '20000000.00',
    maxSalary: '35000000.00',
    description: null,
    isActive: true,
    createdAt: new Date('2026-08-19T02:00:00.000Z'),
    updatedAt: new Date('2026-08-19T02:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

describe('PositionsService', () => {
  let service: PositionsService;
  let repository: jest.Mocked<PositionsRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PositionsService,
        {
          provide: PositionsRepository,
          useValue: {
            findPaginated: jest.fn().mockResolvedValue([[], 0]),
            findById: jest.fn(),
            findByCode: jest.fn().mockResolvedValue(null),
            countDepartment: jest.fn().mockResolvedValue(1),
            countEmployees: jest.fn().mockResolvedValue(0),
            create: jest.fn(),
            update: jest.fn().mockResolvedValue(undefined),
            softDelete: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(PositionsService);
    repository = module.get(PositionsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns DECIMAL fields as numbers in the response (api-spec.md §1.5)', async () => {
      repository.findPaginated.mockResolvedValue([[makePosition()], 1]);

      const result = await service.findAll({});

      expect(result.items[0]).toMatchObject({
        minSalary: 20000000,
        maxSalary: 35000000,
        department: { id: 2, name: 'Phòng Kỹ thuật' },
      });
      expect(result.items[0]).not.toHaveProperty('deletedAt');
    });

    it('clamps limit > 100 down to 100', async () => {
      await service.findAll({ limit: 250 });

      expect(repository.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('passes departmentId + level filters down to the repository', async () => {
      await service.findAll({ departmentId: 2, level: 3 });

      expect(repository.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ departmentId: 2, level: 3 }),
      );
    });
  });

  describe('create', () => {
    it('saves code in UPPERCASE and DECIMAL as a 2-decimal string', async () => {
      repository.create.mockResolvedValue(makePosition({ id: 8 }));
      repository.findById.mockResolvedValue(makePosition({ id: 8 }));

      await service.create({
        code: 'dev_lead',
        name: ' Developer Lead ',
        departmentId: 2,
        level: 3,
        minSalary: 30000000,
        maxSalary: 45000000,
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DEV_LEAD',
          name: 'Developer Lead',
          minSalary: '30000000.00',
          maxSalary: '45000000.00',
        }),
      );
    });

    it('duplicate code → 409 DUPLICATE_POSITION_CODE', async () => {
      repository.findByCode.mockResolvedValue(makePosition());

      await expect(
        service.create({
          code: 'DEV_SENIOR',
          name: 'Trùng',
          departmentId: 2,
          level: 2,
        }),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'DUPLICATE_POSITION_CODE' },
      });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('departmentId does not exist → 422 DEPARTMENT_NOT_FOUND', async () => {
      repository.countDepartment.mockResolvedValue(0);

      await expect(
        service.create({
          code: 'NEW_POS',
          name: 'Chức vụ mới',
          departmentId: 999,
          level: 1,
        }),
      ).rejects.toMatchObject({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        response: { code: 'DEPARTMENT_NOT_FOUND' },
      });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('minSalary > maxSalary → 422 INVALID_SALARY_RANGE', async () => {
      await expect(
        service.create({
          code: 'NEW_POS',
          name: 'Chức vụ mới',
          departmentId: 2,
          level: 1,
          minSalary: 40000000,
          maxSalary: 10000000,
        }),
      ).rejects.toMatchObject({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        response: { code: 'INVALID_SALARY_RANGE' },
      });
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('changing only minSalary is still compared against the existing maxSalary → 422', async () => {
      repository.findById.mockResolvedValue(
        makePosition({ minSalary: '10000000.00', maxSalary: '20000000.00' }),
      );

      await expect(
        service.update(1, { minSalary: 99000000 }),
      ).rejects.toMatchObject({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        response: { code: 'INVALID_SALARY_RANGE' },
      });
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('setting minSalary = null is valid (removes the lower salary bound)', async () => {
      repository.findById.mockResolvedValue(makePosition());

      await service.update(1, { minSalary: null });

      expect(repository.update).toHaveBeenCalledWith(1, {
        minSalary: null,
        maxSalary: '35000000.00',
      });
    });

    it('id does not exist → 404 POSITION_NOT_FOUND', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update(42, { name: 'X' })).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'POSITION_NOT_FOUND' },
      });
    });

    it('explicit null on a non-nullable field (level) → 400 VALIDATION_ERROR, no update', async () => {
      repository.findById.mockResolvedValue(makePosition());

      await expect(
        service.update(1, { level: null } as never),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: 'VALIDATION_ERROR' },
      });
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      repository.findById.mockResolvedValue(makePosition({ id: 4 }));
    });

    it('employees still hold the position → 422 POSITION_HAS_EMPLOYEES, NOT deleted', async () => {
      repository.countEmployees.mockResolvedValue(3);

      await expect(service.remove(4)).rejects.toMatchObject({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        response: { code: 'POSITION_HAS_EMPLOYEES' },
      });
      expect(repository.softDelete).not.toHaveBeenCalled();
    });

    it('no employees left → soft deleted', async () => {
      const result = await service.remove(4);

      expect(repository.softDelete).toHaveBeenCalledWith(4);
      expect(result).toEqual({ id: 4, deleted: true });
    });
  });
});
