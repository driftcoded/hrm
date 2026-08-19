import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Employee } from '@/modules/employees/entities/employee.entity';
import { DepartmentsRepository } from './departments.repository';
import { DepartmentsService } from './departments.service';
import { Department } from './entities/department.entity';

function makeDepartment(overrides: Partial<Department> = {}): Department {
  return {
    id: 1,
    code: 'HR',
    name: 'Phòng Nhân sự',
    description: null,
    parentId: null,
    parent: null,
    children: [],
    managerId: null,
    manager: null,
    sortOrder: 0,
    isActive: true,
    createdAt: new Date('2026-08-19T02:00:00.000Z'),
    updatedAt: new Date('2026-08-19T02:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

/** Only id + fullName are needed for the manager response DTO. */
function makeManager(id: number, fullName: string): Employee {
  return { id, fullName } as Employee;
}

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let repository: jest.Mocked<DepartmentsRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        {
          provide: DepartmentsRepository,
          useValue: {
            findPaginated: jest.fn().mockResolvedValue([[], 0]),
            findAllOrdered: jest.fn().mockResolvedValue([]),
            findById: jest.fn(),
            findParentId: jest.fn().mockResolvedValue(null),
            // 0 = no generated code issued yet, so the next one is PB0001.
            findMaxCodeNumber: jest.fn().mockResolvedValue(0),
            countEmployeesByDepartmentIds: jest.fn().mockResolvedValue([]),
            countPositionsByDepartmentIds: jest.fn().mockResolvedValue([]),
            countManagerCandidate: jest.fn().mockResolvedValue(1),
            countEmployees: jest.fn().mockResolvedValue(0),
            countChildren: jest.fn().mockResolvedValue(0),
            countPositions: jest.fn().mockResolvedValue(0),
            create: jest.fn(),
            update: jest.fn().mockResolvedValue(undefined),
            softDelete: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(DepartmentsService);
    repository = module.get(DepartmentsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------- findAll ---

  describe('findAll', () => {
    it('returns paginated envelope with employeeCount', async () => {
      repository.findPaginated.mockResolvedValue([
        [makeDepartment({ id: 7, manager: makeManager(2, 'Trần Mai') })],
        1,
      ]);
      repository.countEmployeesByDepartmentIds.mockResolvedValue([
        { departmentId: 7, employeeCount: 5 },
      ]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      expect(result.items[0]).toMatchObject({
        id: 7,
        code: 'HR',
        manager: { id: 2, fullName: 'Trần Mai' },
        employeeCount: 5,
      });
      // Response DTO must NOT leak deleted_at (architecture.md §5).
      expect(result.items[0]).not.toHaveProperty('deletedAt');
    });

    it('clamps limit > 100 down to 100 before hitting the repository', async () => {
      await service.findAll({ page: 1, limit: 5000 });

      expect(repository.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100, skip: 0 }),
      );
    });

    it('empty/whitespace-only search does not add a LIKE condition', async () => {
      await service.findAll({ search: '   ' });

      expect(repository.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ search: undefined }),
      );
    });

    it('defaults sort to sortOrder and order to ASC', async () => {
      await service.findAll({});

      expect(repository.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'sortOrder', order: 'ASC' }),
      );
    });
  });

  // --------------------------------------------------------------- findTree ---

  describe('findTree', () => {
    it('nests children under their parent by parent_id', async () => {
      repository.findAllOrdered.mockResolvedValue([
        makeDepartment({ id: 1, code: 'BOD', parentId: null }),
        makeDepartment({ id: 2, code: 'IT', parentId: 1 }),
        makeDepartment({ id: 3, code: 'DEV', parentId: 2 }),
      ]);

      const tree = await service.findTree();

      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe(1);
      expect(tree[0].children.map((child) => child.id)).toEqual([2]);
      expect(tree[0].children[0].children.map((child) => child.id)).toEqual([
        3,
      ]);
    });

    it('promotes a department whose parent was soft-deleted to a root node', async () => {
      repository.findAllOrdered.mockResolvedValue([
        makeDepartment({ id: 9, code: 'ORPHAN', parentId: 404 }),
      ]);

      const tree = await service.findTree();

      expect(tree.map((node) => node.id)).toEqual([9]);
      expect(tree[0].parentId).toBe(404);
    });
  });

  // ---------------------------------------------------------------- findOne ---

  it('findOne with a non-existent id → 404 DEPARTMENT_NOT_FOUND', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.findOne(123)).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: { code: 'DEPARTMENT_NOT_FOUND' },
    });
  });

  // ----------------------------------------------------------------- create ---

  describe('create', () => {
    beforeEach(() => {
      repository.create.mockResolvedValue(makeDepartment({ id: 11 }));
      repository.findById.mockResolvedValue(makeDepartment({ id: 11 }));
    });

    it('generates the code (PB0001 when none has been issued) and trims name', async () => {
      await service.create({ name: '  Phòng Tài chính  ' });

      expect(repository.findMaxCodeNumber).toHaveBeenCalledWith('PB');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PB0001',
          name: 'Phòng Tài chính',
          parentId: null,
          managerId: null,
          sortOrder: 0,
          isActive: true,
        }),
      );
    });

    it('allocates the highest issued number + 1', async () => {
      repository.findMaxCodeNumber.mockResolvedValue(41);

      await service.create({ name: 'Phòng Tài chính' });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'PB0042' }),
      );
    });

    it('ignores a code smuggled into the payload – the generated one wins', async () => {
      // The DTO has no `code`, and the global ValidationPipe (whitelist: true)
      // strips it; this makes sure the service does not read it either.
      await service.create({
        name: 'Phòng Tài chính',
        code: 'CHOSEN_BY_USER',
      } as never);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'PB0001' }),
      );
    });

    it('non-existent parentId → 422 PARENT_DEPARTMENT_NOT_FOUND', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.create({ name: 'Phòng mới', parentId: 99 }),
      ).rejects.toMatchObject({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        response: { code: 'PARENT_DEPARTMENT_NOT_FOUND' },
      });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('managerId that is not an existing employee → 422 EMPLOYEE_NOT_FOUND', async () => {
      repository.countManagerCandidate.mockResolvedValue(0);

      await expect(
        service.create({ name: 'Phòng mới', managerId: 777 }),
      ).rejects.toMatchObject({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        response: { code: 'EMPLOYEE_NOT_FOUND' },
      });
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------- update ---

  describe('update – cycle prevention', () => {
    it('setting parent to ITSELF → 422 DEPARTMENT_CYCLE, no DB write', async () => {
      repository.findById.mockResolvedValue(makeDepartment({ id: 5 }));

      await expect(service.update(5, { parentId: 5 })).rejects.toMatchObject({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        response: { code: 'DEPARTMENT_CYCLE' },
      });
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('setting parent to a DESCENDANT department → 422 DEPARTMENT_CYCLE, no DB write', async () => {
      // Tree: 1 → 2 → 3. Setting 1's parent to 3 would create a cycle.
      repository.findById.mockImplementation((id: number) =>
        Promise.resolve(
          makeDepartment({ id, parentId: id === 1 ? null : id - 1 }),
        ),
      );
      // Walking up from 3: 3 → 2 → 1 (encounters itself again).
      repository.findParentId.mockImplementation((id: number) =>
        Promise.resolve(id === 1 ? null : id - 1),
      );

      await expect(service.update(1, { parentId: 3 })).rejects.toMatchObject({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        response: { code: 'DEPARTMENT_CYCLE' },
      });
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('setting parent to an unrelated department → updates normally', async () => {
      repository.findById.mockImplementation((id: number) =>
        Promise.resolve(makeDepartment({ id })),
      );
      repository.findParentId.mockResolvedValue(null);

      await service.update(4, { parentId: 9 });

      expect(repository.update).toHaveBeenCalledWith(4, { parentId: 9 });
    });

    it('does not loop infinitely when the data already has a cycle (2 ↔ 3)', async () => {
      repository.findById.mockImplementation((id: number) =>
        Promise.resolve(makeDepartment({ id })),
      );
      repository.findParentId.mockImplementation((id: number) =>
        Promise.resolve(id === 2 ? 3 : 2),
      );

      await service.update(10, { parentId: 2 });

      expect(repository.update).toHaveBeenCalledWith(10, { parentId: 2 });
    });

    it('parentId = null → detaches from parent (becomes a root department)', async () => {
      repository.findById.mockResolvedValue(
        makeDepartment({ id: 6, parentId: 1 }),
      );

      await service.update(6, { parentId: null });

      expect(repository.update).toHaveBeenCalledWith(6, { parentId: null });
      expect(repository.findParentId).not.toHaveBeenCalled();
    });

    it('code is immutable: a code in the body changes nothing', async () => {
      repository.findById.mockResolvedValue(
        makeDepartment({ id: 6, code: 'PB0006' }),
      );

      const result = await service.update(6, { code: 'PB9999' } as never);

      // Nothing to patch → no DB write at all, and the code is unchanged.
      expect(repository.update).not.toHaveBeenCalled();
      expect(result.code).toBe('PB0006');
    });

    it('empty body → does not call update but still returns the current record', async () => {
      repository.findById.mockResolvedValue(makeDepartment({ id: 6 }));

      const result = await service.update(6, {});

      expect(repository.update).not.toHaveBeenCalled();
      expect(result.id).toBe(6);
    });

    it('explicit null on a non-nullable field (name) → 400 VALIDATION_ERROR, no update', async () => {
      repository.findById.mockResolvedValue(makeDepartment({ id: 6 }));

      await expect(
        service.update(6, { name: null } as never),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: 'VALIDATION_ERROR' },
      });
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('null on a nullable field (parentId) is accepted → detaches from parent', async () => {
      repository.findById.mockResolvedValue(
        makeDepartment({ id: 6, parentId: 1 }),
      );

      await service.update(6, { parentId: null });

      expect(repository.update).toHaveBeenCalledWith(6, { parentId: null });
    });
  });

  // ----------------------------------------------------------------- remove ---

  describe('remove – does NOT cascade', () => {
    beforeEach(() => {
      repository.findById.mockResolvedValue(makeDepartment({ id: 3 }));
    });

    it('still has employees → 422 DEPARTMENT_HAS_EMPLOYEES, deletes nothing', async () => {
      repository.countEmployees.mockResolvedValue(4);

      const error: unknown = await service.remove(3).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect(error).toMatchObject({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        response: { code: 'DEPARTMENT_HAS_EMPLOYEES' },
      });
      expect((error as HttpException).message).toContain('4 employee(s)');
      expect(repository.softDelete).not.toHaveBeenCalled();
    });

    it('still has child departments → 422 DEPARTMENT_HAS_CHILDREN', async () => {
      repository.countChildren.mockResolvedValue(2);

      await expect(service.remove(3)).rejects.toMatchObject({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        response: { code: 'DEPARTMENT_HAS_CHILDREN' },
      });
      expect(repository.softDelete).not.toHaveBeenCalled();
    });

    it('still has positions → 422 DEPARTMENT_HAS_POSITIONS', async () => {
      repository.countPositions.mockResolvedValue(1);

      await expect(service.remove(3)).rejects.toMatchObject({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        response: { code: 'DEPARTMENT_HAS_POSITIONS' },
      });
      expect(repository.softDelete).not.toHaveBeenCalled();
    });

    it('no remaining references → soft deletes', async () => {
      const result = await service.remove(3);

      expect(repository.softDelete).toHaveBeenCalledWith(3);
      expect(result).toEqual({ id: 3, deleted: true });
    });

    it('non-existent id → 404, does not check references', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'DEPARTMENT_NOT_FOUND' },
      });
      expect(repository.countEmployees).not.toHaveBeenCalled();
    });
  });
});
