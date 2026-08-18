import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { normalizeCode } from '@/common/utils/code.util';
import { toIsoString } from '@/common/utils/date.util';
import { resolvePagination } from '@/common/utils/pagination.util';
import { rejectUnexpectedNulls } from '@/common/utils/reject-null.util';
import { CreatePositionDto } from './dto/create-position.dto';
import { FilterPositionDto } from './dto/filter-position.dto';
import { PositionResponseDto } from './dto/position-response.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { Position } from './entities/position.entity';
import { PositionsRepository } from './positions.repository';

/** All business logic for positions (CLAUDE.md §Module architecture). */
@Injectable()
export class PositionsService {
  constructor(private readonly positionsRepository: PositionsRepository) {}

  async findAll(
    filter: FilterPositionDto,
  ): Promise<PaginatedResponseDto<PositionResponseDto>> {
    const { page, limit, skip } = resolvePagination(filter);
    const search = filter.search?.trim();

    const [positions, total] = await this.positionsRepository.findPaginated({
      skip,
      take: limit,
      sort: filter.sort ?? 'code',
      order: filter.order === 'desc' ? 'DESC' : 'ASC',
      departmentId: filter.departmentId,
      level: filter.level,
      isActive: filter.isActive,
      search: search && search.length > 0 ? search : undefined,
    });

    return new PaginatedResponseDto(
      positions.map((position) => this.toResponse(position)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: number): Promise<PositionResponseDto> {
    return this.toResponse(await this.getExistingOrThrow(id));
  }

  async create(dto: CreatePositionDto): Promise<PositionResponseDto> {
    const code = normalizeCode(dto.code);
    await this.assertCodeAvailable(code);
    await this.assertDepartmentExists(dto.departmentId);

    const minSalary = dto.minSalary ?? null;
    const maxSalary = dto.maxSalary ?? null;
    assertSalaryRange(minSalary, maxSalary);

    const created = await this.positionsRepository.create({
      code,
      name: dto.name.trim(),
      departmentId: dto.departmentId,
      level: dto.level,
      minSalary: toDecimalString(minSalary),
      maxSalary: toDecimalString(maxSalary),
      description: dto.description ?? null,
      isActive: dto.isActive ?? true,
    });

    return this.findOne(Number(created.id));
  }

  async update(
    id: number,
    dto: UpdatePositionDto,
  ): Promise<PositionResponseDto> {
    const position = await this.getExistingOrThrow(id);
    rejectUnexpectedNulls(dto, ['minSalary', 'maxSalary', 'description']);
    const patch: Partial<Position> = {};

    if (dto.code !== undefined) {
      const code = normalizeCode(dto.code);
      if (code !== position.code) {
        await this.assertCodeAvailable(code);
      }
      patch.code = code;
    }

    if (dto.name !== undefined) {
      patch.name = dto.name.trim();
    }

    if (dto.departmentId !== undefined) {
      await this.assertDepartmentExists(dto.departmentId);
      patch.departmentId = dto.departmentId;
    }

    if (dto.level !== undefined) {
      patch.level = dto.level;
    }

    // The salary range must remain valid AFTER merging: changing only one bound still requires comparing it against the other.
    const minSalary =
      dto.minSalary !== undefined
        ? (dto.minSalary ?? null)
        : toNumberOrNull(position.minSalary);
    const maxSalary =
      dto.maxSalary !== undefined
        ? (dto.maxSalary ?? null)
        : toNumberOrNull(position.maxSalary);

    if (dto.minSalary !== undefined || dto.maxSalary !== undefined) {
      assertSalaryRange(minSalary, maxSalary);
      patch.minSalary = toDecimalString(minSalary);
      patch.maxSalary = toDecimalString(maxSalary);
    }

    if (dto.description !== undefined) {
      patch.description = dto.description ?? null;
    }

    if (dto.isActive !== undefined) {
      patch.isActive = dto.isActive;
    }

    if (Object.keys(patch).length > 0) {
      await this.positionsRepository.update(id, patch);
    }

    return this.findOne(id);
  }

  /** Soft delete; rejected if employees still hold this position (must not cascade-delete employees). */
  async remove(id: number): Promise<{ id: number; deleted: boolean }> {
    await this.getExistingOrThrow(id);

    const employeeCount = await this.positionsRepository.countEmployees(id);
    if (employeeCount > 0) {
      throw new UnprocessableEntityException({
        code: 'POSITION_HAS_EMPLOYEES',
        message: `Cannot delete position ${id}: ${employeeCount} employee(s) currently hold it`,
      });
    }

    await this.positionsRepository.softDelete(id);

    return { id, deleted: true };
  }

  // ------------------------------------------------------------ internals ----

  private async getExistingOrThrow(id: number): Promise<Position> {
    const position = await this.positionsRepository.findById(id);

    if (!position) {
      throw new NotFoundException({
        code: 'POSITION_NOT_FOUND',
        message: `Cannot find position with id ${id}`,
      });
    }

    return position;
  }

  private async assertCodeAvailable(code: string): Promise<void> {
    const existing = await this.positionsRepository.findByCode(code);

    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_POSITION_CODE',
        message: `Position code "${code}" already exists`,
      });
    }
  }

  private async assertDepartmentExists(departmentId: number): Promise<void> {
    const count = await this.positionsRepository.countDepartment(departmentId);

    if (count === 0) {
      throw new UnprocessableEntityException({
        code: 'DEPARTMENT_NOT_FOUND',
        message: `Cannot find department with id ${departmentId}`,
      });
    }
  }

  private toResponse(position: Position): PositionResponseDto {
    return {
      id: Number(position.id),
      code: position.code,
      name: position.name,
      department: position.department
        ? {
            id: Number(position.department.id),
            name: position.department.name,
          }
        : null,
      level: Number(position.level),
      minSalary: toNumberOrNull(position.minSalary),
      maxSalary: toNumberOrNull(position.maxSalary),
      description: position.description ?? null,
      isActive: Boolean(position.isActive),
      createdAt: toIsoString(position.createdAt),
      updatedAt: toIsoString(position.updatedAt),
    };
  }
}

/** DB driver returns DECIMAL as a string → convert to number for the response (api-spec.md §1.5). */
export function toNumberOrNull(value: string | number | null): number | null {
  return value === null || value === undefined ? null : Number(value);
}

/** Reverse: number → string so TypeORM writes the DECIMAL column without losing precision. */
function toDecimalString(value: number | null): string | null {
  return value === null ? null : value.toFixed(2);
}

/**
 * Salary range must be sane: `min_salary` ≤ `max_salary`.
 * Schema §2.2 has no DB-level constraint for this, so it is enforced in the service.
 */
export function assertSalaryRange(
  minSalary: number | null,
  maxSalary: number | null,
): void {
  if (minSalary !== null && maxSalary !== null && minSalary > maxSalary) {
    throw new UnprocessableEntityException({
      code: 'INVALID_SALARY_RANGE',
      message: `minSalary (${minSalary}) must not be greater than maxSalary (${maxSalary})`,
    });
  }
}
