import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { normalizeCode } from '@/common/utils/code.util';
import { rejectUnexpectedNulls } from '@/common/utils/reject-null.util';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { FilterLeaveTypeDto } from './dto/filter-leave-type.dto';
import { LeaveTypeResponseDto } from './dto/leave-type-response.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { LeaveApplicableGender, LeaveType } from './entities/leave-type.entity';
import { LeaveTypesRepository } from './leave-types.repository';

/** All leave-type business logic lives here (CLAUDE.md §Module architecture). */
@Injectable()
export class LeaveTypesService {
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

  async create(dto: CreateLeaveTypeDto): Promise<LeaveTypeResponseDto> {
    const code = normalizeCode(dto.code);
    await this.assertCodeAvailable(code);

    const created = await this.leaveTypesRepository.create({
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
    });

    return this.findOne(Number(created.id));
  }

  async update(
    id: number,
    dto: UpdateLeaveTypeDto,
  ): Promise<LeaveTypeResponseDto> {
    const leaveType = await this.getExistingOrThrow(id);
    rejectUnexpectedNulls(dto, ['maxConsecutive', 'description']);
    const patch: Partial<LeaveType> = {};

    if (dto.code !== undefined) {
      const code = normalizeCode(dto.code);
      if (code !== leaveType.code) {
        this.assertNotSystemLocked(leaveType, 'renamed');
        await this.assertCodeAvailable(code);
      }
      patch.code = code;
    }

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
   * Reject the delete if any leave request or leave balance still references
   * this type: deleting it would destroy an employee's leave history (the FK
   * is also RESTRICT at the DB level).
   * To "hide" a leave type from the UI instead, PATCH `isActive: false`.
   */
  async remove(id: number): Promise<{ id: number; deleted: boolean }> {
    const leaveType = await this.getExistingOrThrow(id);
    this.assertNotSystemLocked(leaveType, 'deleted');

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

  private async assertCodeAvailable(code: string): Promise<void> {
    const existing = await this.leaveTypesRepository.findByCode(code);

    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_LEAVE_TYPE_CODE',
        message: `Leave type code "${code}" already exists`,
      });
    }
  }

  /**
   * Statutory rows (`isSystem`) keep their `code` and can never be deleted —
   * their code is a stable identifier that payroll/leave-balance logic will
   * special-case by value, and deleting one outright loses that identity for
   * good. Everything else (daysPerYear, description, isActive, ...) stays
   * editable, since companies may grant more than the legal minimum.
   */
  private assertNotSystemLocked(
    leaveType: LeaveType,
    action: 'renamed' | 'deleted',
  ): void {
    if (!leaveType.isSystem) {
      return;
    }

    throw new ForbiddenException({
      code: 'LEAVE_TYPE_SYSTEM_LOCKED',
      message: `Leave type ${leaveType.id} ("${leaveType.code}") is a statutory type and cannot be ${action}. Use isActive=false to hide it instead.`,
    });
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
