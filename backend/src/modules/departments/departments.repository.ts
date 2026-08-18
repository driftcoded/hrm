import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '@/modules/employees/entities/employee.entity';
import { Position } from '@/modules/positions/entities/position.entity';
import { Department } from './entities/department.entity';
import { DepartmentSortKey } from './dto/filter-department.dto';

/** Maps `sort` (whitelisted in FilterDepartmentDto) to a safe SQL column. */
const SORT_COLUMNS: Record<DepartmentSortKey, string> = {
  code: 'department.code',
  name: 'department.name',
  sortOrder: 'department.sortOrder',
  createdAt: 'department.createdAt',
};

export interface FindDepartmentsOptions {
  skip: number;
  take: number;
  sort: DepartmentSortKey;
  order: 'ASC' | 'DESC';
  parentId?: number;
  isActive?: boolean;
  search?: string;
}

export interface DepartmentEmployeeCount {
  departmentId: number;
  employeeCount: number;
}

/**
 * Contains only TypeORM queries, no business if/else (CLAUDE.md §Module
 * architecture). QueryBuilder automatically adds `deleted_at IS NULL` because
 * the entity has @DeleteDateColumn, so soft-deleted rows never appear in
 * list/detail results.
 */
@Injectable()
export class DepartmentsRepository {
  constructor(
    @InjectRepository(Department)
    private readonly repository: Repository<Department>,
    // Counts employees/positions belonging to a department (delete guards +
    // employeeCount). This query belongs to department business logic, so it
    // lives in this repository rather than the employee/position modules.
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(Position)
    private readonly positionRepository: Repository<Position>,
  ) {}

  findPaginated(
    options: FindDepartmentsOptions,
  ): Promise<[Department[], number]> {
    const query = this.repository
      .createQueryBuilder('department')
      .leftJoinAndSelect('department.manager', 'manager')
      .orderBy(SORT_COLUMNS[options.sort], options.order)
      .addOrderBy('department.id', 'ASC')
      .skip(options.skip)
      .take(options.take);

    if (options.parentId !== undefined) {
      query.andWhere('department.parentId = :parentId', {
        parentId: options.parentId,
      });
    }

    if (options.isActive !== undefined) {
      query.andWhere('department.isActive = :isActive', {
        isActive: options.isActive,
      });
    }

    if (options.search) {
      query.andWhere(
        '(department.code LIKE :search OR department.name LIKE :search)',
        { search: `%${options.search}%` },
      );
    }

    return query.getManyAndCount();
  }

  /** All non-deleted departments – the service builds the tree from this flat list. */
  findAllOrdered(): Promise<Department[]> {
    return this.repository
      .createQueryBuilder('department')
      .leftJoinAndSelect('department.manager', 'manager')
      .orderBy('department.sortOrder', 'ASC')
      .addOrderBy('department.name', 'ASC')
      .getMany();
  }

  findById(id: number): Promise<Department | null> {
    return this.repository
      .createQueryBuilder('department')
      .leftJoinAndSelect('department.manager', 'manager')
      .where('department.id = :id', { id })
      .getOne();
  }

  /**
   * `withDeleted()`: `code` has a plain (non-filtered) UNIQUE constraint at the
   * DB level, so a soft-deleted department still blocks reusing its code. This
   * must see soft-deleted rows too, or the service's pre-check would pass and
   * the INSERT would fail with a raw `ER_DUP_ENTRY` instead of a clean 409.
   */
  findByCode(code: string): Promise<Department | null> {
    return this.repository
      .createQueryBuilder('department')
      .withDeleted()
      .where('department.code = :code', { code })
      .getOne();
  }

  /** `parent_id` of a department – used to walk up to the root when checking for cycles. */
  async findParentId(id: number): Promise<number | null> {
    const row = await this.repository
      .createQueryBuilder('department')
      .select('department.parentId', 'parentId')
      .where('department.id = :id', { id })
      .getRawOne<{ parentId: string | number | null }>();

    if (!row || row.parentId === null) {
      return null;
    }

    return Number(row.parentId);
  }

  async countEmployeesByDepartmentIds(
    departmentIds: number[],
  ): Promise<DepartmentEmployeeCount[]> {
    if (departmentIds.length === 0) {
      return [];
    }

    const rows = await this.employeeRepository
      .createQueryBuilder('employee')
      .select('employee.departmentId', 'departmentId')
      .addSelect('COUNT(employee.id)', 'employeeCount')
      .where('employee.departmentId IN (:...departmentIds)', { departmentIds })
      .groupBy('employee.departmentId')
      .getRawMany<{
        departmentId: string | number;
        employeeCount: string | number;
      }>();

    return rows.map((row) => ({
      departmentId: Number(row.departmentId),
      employeeCount: Number(row.employeeCount),
    }));
  }

  /** An employee (not soft-deleted) eligible to be assigned as department manager. */
  countManagerCandidate(employeeId: number): Promise<number> {
    return this.employeeRepository
      .createQueryBuilder('employee')
      .where('employee.id = :employeeId', { employeeId })
      .getCount();
  }

  countEmployees(departmentId: number): Promise<number> {
    return this.employeeRepository
      .createQueryBuilder('employee')
      .where('employee.departmentId = :departmentId', { departmentId })
      .getCount();
  }

  countChildren(parentId: number): Promise<number> {
    return this.repository
      .createQueryBuilder('department')
      .where('department.parentId = :parentId', { parentId })
      .getCount();
  }

  countPositions(departmentId: number): Promise<number> {
    return this.positionRepository
      .createQueryBuilder('position')
      .where('position.departmentId = :departmentId', { departmentId })
      .getCount();
  }

  create(data: Partial<Department>): Promise<Department> {
    return this.repository.save(this.repository.create(data));
  }

  async update(id: number, data: Partial<Department>): Promise<void> {
    await this.repository.update({ id }, data);
  }

  /** Soft delete: only sets `deleted_at` (schema §2.1 + architecture.md §16.4). */
  async softDelete(id: number): Promise<void> {
    await this.repository.softDelete({ id });
  }
}
