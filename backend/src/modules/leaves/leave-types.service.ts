import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { rejectUnexpectedNulls } from '@/common/utils/reject-null.util';
import { createWithSequentialCode } from '@/common/utils/sequential-code.util';
import { LEAVE_TYPE_CODE_PREFIX } from './leave-types.constants';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { FilterLeaveTypeDto } from './dto/filter-leave-type.dto';
import { LeaveTypeResponseDto } from './dto/leave-type-response.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { LeaveApplicableGender, LeaveType } from './entities/leave-type.entity';
import { LeaveTypesRepository } from './leave-types.repository';

/** All leave-type business logic lives here (CLAUDE.md §Module architecture). */
@Injectable()
export class LeaveTypesService {
  private readonly logger = new Logger(LeaveTypesService.name);

  constructor(private readonly leaveTypesRepository: LeaveTypesRepository) {}

  async findAll(filter: FilterLeaveTypeDto): Promise<LeaveTypeResponseDto[]> {
    const leaveTypes = await this.leaveTypesRepository.findAll({
      isActive: filter.isActive,
      applicableGender: filter.applicableGender,
    });

    return leaveTypes.map((leaveType) => this.toResponse(leaveType));
  }

  async findOne(id: number): Promise<LeaveTypeResponseDto> {
    return this.toResponse(await this.getExistingOrThrow(id));
  }

  /**
   * `code` is server-generated (`NP0001`…).
   *
   * The nine statutory types keep their meaningful seeded codes (`ANNUAL`,
   * `SICK`, …) because business rules and legislation refer to them by name;
   * only company-defined types added later get a generated code. That is why
   * the two styles coexist in this table.
   */
  async create(dto: CreateLeaveTypeDto): Promise<LeaveTypeResponseDto> {
    const created = await createWithSequentialCode(
      { prefix: LEAVE_TYPE_CODE_PREFIX, uniqueColumn: 'code' },
      () => this.leaveTypesRepository.findMaxCodeNumber(LEAVE_TYPE_CODE_PREFIX),
      (code) =>
        this.leaveTypesRepository.create({
          code,
          name: dto.name.trim(),
          daysPerYear: toDecimalString(dto.daysPerYear),
          isPaid: dto.isPaid ?? true,
          requireApproval: dto.requireApproval ?? true,
          minDays: toDecimalString(dto.minDays ?? 0.5),
          maxConsecutive: dto.maxConsecutive ?? null,
          advanceNoticeDays: dto.advanceNoticeDays ?? 1,
          applicableGender: dto.applicableGender ?? LeaveApplicableGender.ALL,
          description: dto.description ?? null,
          isActive: dto.isActive ?? true,
          sortOrder: dto.sortOrder ?? 0,
          // Only the seed marks a type as statutory; anything created through
          // the API is company-defined and stays editable.
          isSystem: false,
        }),
      this.logger,
    );

    return this.findOne(Number(created.id));
  }

  async update(
    id: number,
    dto: UpdateLeaveTypeDto,
  ): Promise<LeaveTypeResponseDto> {
    await this.getExistingOrThrow(id);
    rejectUnexpectedNulls(dto, ['maxConsecutive', 'description']);
    const patch: Partial<LeaveType> = {};

    // `code` is absent from UpdateLeaveTypeDto by design: generated on create
    // and immutable afterwards. This also removes the old hazard of renaming a
    // statutory code (`ANNUAL`) that business rules match on.

    if (dto.name !== undefined) {
      patch.name = dto.name.trim();
    }

    if (dto.daysPerYear !== undefined) {
      patch.daysPerYear = toDecimalString(dto.daysPerYear);
    }

    if (dto.isPaid !== undefined) {
      patch.isPaid = dto.isPaid;
    }

    if (dto.requireApproval !== undefined) {
      patch.requireApproval = dto.requireApproval;
    }

    if (dto.minDays !== undefined) {
      patch.minDays = toDecimalString(dto.minDays);
    }

    if (dto.maxConsecutive !== undefined) {
      patch.maxConsecutive = dto.maxConsecutive ?? null;
    }

    if (dto.advanceNoticeDays !== undefined) {
      patch.advanceNoticeDays = dto.advanceNoticeDays;
    }

    if (dto.applicableGender !== undefined) {
      patch.applicableGender = dto.applicableGender;
    }

    if (dto.description !== undefined) {
      patch.description = dto.description ?? null;
    }

    if (dto.isActive !== undefined) {
      patch.isActive = dto.isActive;
    }

    if (dto.sortOrder !== undefined) {
      patch.sortOrder = dto.sortOrder;
    }

    if (Object.keys(patch).length > 0) {
      await this.leaveTypesRepository.update(id, patch);
    }

    return this.findOne(id);
  }

  /**
   * `leave_types` has no `deleted_at` → this is a HARD delete.
   *
   * "Still in use" is the ONLY delete guard: if a leave request or leave balance
   * references this type, deleting it would destroy an employee's leave history
   * (the FK is RESTRICT at the DB level anyway). To "hide" a leave type from the
   * UI instead, PATCH `isActive: false`.
   *
   * `isSystem` deliberately does NOT block anything. Legislation changes —
   * entitlements are raised and statutory types get repealed (BLLĐ 2019
   * abolished the `seasonal` contract type the same way) — so HR must be able to
   * maintain these rows. A statutory type that carries history is still
   * undeletable, but because of LEAVE_TYPE_IN_USE, which is the right reason.
   */
  async remove(id: number): Promise<{ id: number; deleted: boolean }> {
    await this.getExistingOrThrow(id);

    const requestCount = await this.leaveTypesRepository.countLeaveRequests(id);
    const balanceCount = await this.leaveTypesRepository.countLeaveBalances(id);

    if (requestCount > 0 || balanceCount > 0) {
      throw new UnprocessableEntityException({
        code: 'LEAVE_TYPE_IN_USE',
        message: `Cannot delete leave type ${id}: referenced by ${requestCount} leave request(s) and ${balanceCount} leave balance(s). Set isActive=false instead`,
      });
    }

    await this.leaveTypesRepository.delete(id);

    return { id, deleted: true };
  }

  // ------------------------------------------------------------ internals ----

  private async getExistingOrThrow(id: number): Promise<LeaveType> {
    const leaveType = await this.leaveTypesRepository.findById(id);

    if (!leaveType) {
      throw new NotFoundException({
        code: 'LEAVE_TYPE_NOT_FOUND',
        message: `Cannot find leave type with id ${id}`,
      });
    }

    return leaveType;
  }

  private toResponse(leaveType: LeaveType): LeaveTypeResponseDto {
    return {
      id: Number(leaveType.id),
      code: leaveType.code,
      name: leaveType.name,
      daysPerYear: Number(leaveType.daysPerYear),
      isPaid: Boolean(leaveType.isPaid),
      requireApproval: Boolean(leaveType.requireApproval),
      minDays: Number(leaveType.minDays),
      maxConsecutive:
        leaveType.maxConsecutive === null
          ? null
          : Number(leaveType.maxConsecutive),
      advanceNoticeDays: Number(leaveType.advanceNoticeDays),
      applicableGender: leaveType.applicableGender,
      description: leaveType.description ?? null,
      isActive: Boolean(leaveType.isActive),
      sortOrder: Number(leaveType.sortOrder),
      isSystem: Boolean(leaveType.isSystem),
    };
  }
}

/** DECIMAL(5,1)/(4,1) columns: write as a 1-decimal-place string to avoid rounding drift. */
function toDecimalString(value: number): string {
  return value.toFixed(1);
}
