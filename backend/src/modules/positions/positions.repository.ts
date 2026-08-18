import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from '@/modules/departments/entities/department.entity';
import { Employee } from '@/modules/employees/entities/employee.entity';
import { Position } from './entities/position.entity';
import { PositionSortKey } from './dto/filter-position.dto';

/** Maps `sort` (whitelisted in FilterPositionDto) to a safe SQL column. */
const SORT_COLUMNS: Record<PositionSortKey, string> = {
  code: 'position.code',
  name: 'position.name',
  level: 'position.level',
  createdAt: 'position.createdAt',
};

export interface FindPositionsOptions {
  skip: number;
  take: number;
  sort: PositionSortKey;
  order: 'ASC' | 'DESC';
  departmentId?: number;
  level?: number;
  isActive?: boolean;
  search?: string;
}

/** TypeORM queries only, no business logic (CLAUDE.md §Module architecture). */
@Injectable()
export class PositionsRepository {
  constructor(
    @InjectRepository(Position)
    private readonly repository: Repository<Position>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
  ) {}

  findPaginated(options: FindPositionsOptions): Promise<[Position[], number]> {
    const query = this.repository
      .createQueryBuilder('position')
      .leftJoinAndSelect('position.department', 'department')
      .orderBy(SORT_COLUMNS[options.sort], options.order)
      .addOrderBy('position.id', 'ASC')
      .skip(options.skip)
      .take(options.take);

    if (options.departmentId !== undefined) {
      query.andWhere('position.departmentId = :departmentId', {
        departmentId: options.departmentId,
      });
    }

    if (options.level !== undefined) {
      query.andWhere('position.level = :level', { level: options.level });
    }

    if (options.isActive !== undefined) {
      query.andWhere('position.isActive = :isActive', {
        isActive: options.isActive,
      });
    }

    if (options.search) {
      query.andWhere(
        '(position.code LIKE :search OR position.name LIKE :search)',
        { search: `%${options.search}%` },
      );
    }

    return query.getManyAndCount();
  }

  findById(id: number): Promise<Position | null> {
    return this.repository
      .createQueryBuilder('position')
      .leftJoinAndSelect('position.department', 'department')
      .where('position.id = :id', { id })
      .getOne();
  }

  /**
   * `withDeleted()`: `code` has a plain (non-filtered) UNIQUE constraint at the
   * DB level, so a soft-deleted position still blocks reusing its code. This
   * must see soft-deleted rows too, or the service's pre-check would pass and
   * the INSERT would fail with a raw `ER_DUP_ENTRY` instead of a clean 409.
   */
  findByCode(code: string): Promise<Position | null> {
    return this.repository
      .createQueryBuilder('position')
      .withDeleted()
      .where('position.code = :code', { code })
      .getOne();
  }

  /** Whether the department (not soft-deleted) exists – used to validate departmentId. */
  countDepartment(departmentId: number): Promise<number> {
    return this.departmentRepository
      .createQueryBuilder('department')
      .where('department.id = :departmentId', { departmentId })
      .getCount();
  }

  /** Employees currently holding this position – used to guard deletion. */
  countEmployees(positionId: number): Promise<number> {
    return this.employeeRepository
      .createQueryBuilder('employee')
      .where('employee.positionId = :positionId', { positionId })
      .getCount();
  }

  create(data: Partial<Position>): Promise<Position> {
    return this.repository.save(this.repository.create(data));
  }

  async update(id: number, data: Partial<Position>): Promise<void> {
    await this.repository.update({ id }, data);
  }

  async softDelete(id: number): Promise<void> {
    await this.repository.softDelete({ id });
  }
}
