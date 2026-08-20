import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { toDateOnlyString, toIsoString } from '@/common/utils/date.util';
import { EmployeesService } from '@/modules/employees/employees.service';
import { CreateDisciplineRewardDto } from './dto/create-discipline-reward.dto';
import { DisciplineRewardResponseDto } from './dto/discipline-reward-response.dto';
import { UpdateDisciplineRewardDto } from './dto/update-discipline-reward.dto';
import { DisciplinesRewardsRepository } from './disciplines-rewards.repository';
import {
  DisciplineReward,
  DisciplineRewardType,
} from './entities/discipline-reward.entity';

/**
 * Khen thưởng và kỷ luật của nhân viên (PLAN 7.1, business-rules.md §14).
 *
 * Phạm vi xem lấy từ `EmployeesService.findOne()`. Tiền thưởng thực trả không
 * lưu ở đây mà đi qua `salaries.performance_bonus`.
 */
@Injectable()
export class DisciplinesRewardsService {
  private readonly logger = new Logger(DisciplinesRewardsService.name);

  constructor(
    private readonly repository: DisciplinesRewardsRepository,
    private readonly employeesService: EmployeesService,
  ) {}

  async findAll(
    employeeId: number,
    type: DisciplineRewardType | undefined,
    user: AuthenticatedUser,
  ): Promise<DisciplineRewardResponseDto[]> {
    await this.employeesService.findOne(employeeId, user);

    const records = await this.repository.findByEmployee(employeeId, type);

    return records.map((record) => this.toResponse(record));
  }

  async create(
    employeeId: number,
    dto: CreateDisciplineRewardDto,
    user: AuthenticatedUser,
  ): Promise<DisciplineRewardResponseDto> {
    await this.employeesService.findOne(employeeId, user);

    this.assertDatesOrdered(dto.decisionDate, dto.effectiveDate);

    const created = await this.repository.create({
      employeeId,
      type: dto.type,
      category: dto.category.trim(),
      title: dto.title.trim(),
      description: dto.description.trim(),
      decisionNumber: dto.decisionNumber?.trim() || null,
      decisionDate: dto.decisionDate,
      effectiveDate: dto.effectiveDate,
      issuedBy: dto.issuedById ?? null,
      documentUrl: dto.documentUrl?.trim() || null,
      note: dto.note?.trim() || null,
    });

    this.logger.log(
      `${dto.type} "${dto.title}" recorded for employee ${employeeId} by user ${user.userId}`,
    );

    return this.toResponse(await this.getExistingOrThrow(Number(created.id)));
  }

  async update(
    employeeId: number,
    recordId: number,
    dto: UpdateDisciplineRewardDto,
    user: AuthenticatedUser,
  ): Promise<DisciplineRewardResponseDto> {
    await this.employeesService.findOne(employeeId, user);

    const record = await this.getExistingOrThrow(recordId);

    this.assertBelongsTo(record, employeeId);

    this.assertDatesOrdered(
      dto.decisionDate ?? toDateOnlyString(record.decisionDate),
      dto.effectiveDate ?? toDateOnlyString(record.effectiveDate),
    );

    if (dto.type !== undefined) {
      record.type = dto.type;
    }
    if (dto.category !== undefined) {
      record.category = dto.category.trim();
    }
    if (dto.title !== undefined) {
      record.title = dto.title.trim();
    }
    if (dto.description !== undefined) {
      record.description = dto.description.trim();
    }
    if (dto.decisionNumber !== undefined) {
      record.decisionNumber = dto.decisionNumber.trim() || null;
    }
    if (dto.decisionDate !== undefined) {
      record.decisionDate = dto.decisionDate;
    }
    if (dto.effectiveDate !== undefined) {
      record.effectiveDate = dto.effectiveDate;
    }
    if (dto.issuedById !== undefined) {
      record.issuedBy = dto.issuedById;
    }
    if (dto.documentUrl !== undefined) {
      record.documentUrl = dto.documentUrl.trim() || null;
    }
    if (dto.note !== undefined) {
      record.note = dto.note.trim() || null;
    }

    await this.repository.save(record);

    return this.toResponse(await this.getExistingOrThrow(recordId));
  }

  async remove(
    employeeId: number,
    recordId: number,
    user: AuthenticatedUser,
  ): Promise<{ id: number; deleted: boolean }> {
    await this.employeesService.findOne(employeeId, user);

    const record = await this.getExistingOrThrow(recordId);

    this.assertBelongsTo(record, employeeId);

    await this.repository.remove(recordId);

    this.logger.warn(
      `${record.type} record ${recordId} of employee ${employeeId} deleted by user ${user.userId}`,
    );

    return { id: recordId, deleted: true };
  }

  // --------------------------------------------------------- nội bộ ----

  /** Chặn ngày hiệu lực nằm trước ngày ký quyết định. */
  private assertDatesOrdered(
    decisionDate: string,
    effectiveDate: string,
  ): void {
    if (effectiveDate < decisionDate) {
      throw new UnprocessableEntityException({
        code: 'EFFECTIVE_BEFORE_DECISION',
        message: `effective date (${effectiveDate}) is before the decision date (${decisionDate})`,
      });
    }
  }

  /** Chặn thao tác lên bản ghi của nhân viên khác trên cùng đường dẫn. */
  private assertBelongsTo(record: DisciplineReward, employeeId: number): void {
    if (Number(record.employeeId) !== employeeId) {
      throw new NotFoundException({
        code: 'DISCIPLINE_REWARD_NOT_FOUND',
        message: `Record ${record.id} does not belong to employee ${employeeId}`,
      });
    }
  }

  private async getExistingOrThrow(id: number): Promise<DisciplineReward> {
    const record = await this.repository.findById(id);

    if (!record) {
      throw new NotFoundException({
        code: 'DISCIPLINE_REWARD_NOT_FOUND',
        message: `Discipline/reward record ${id} not found`,
      });
    }

    return record;
  }

  private toResponse(record: DisciplineReward): DisciplineRewardResponseDto {
    return {
      id: Number(record.id),
      employeeId: Number(record.employeeId),
      type: record.type,
      category: record.category,
      title: record.title,
      description: record.description,
      decisionNumber: record.decisionNumber,
      decisionDate: toDateOnlyString(record.decisionDate),
      effectiveDate: toDateOnlyString(record.effectiveDate),
      issuedBy: record.issuer
        ? { id: Number(record.issuer.id), fullName: record.issuer.fullName }
        : null,
      documentUrl: record.documentUrl,
      note: record.note,
      createdAt: toIsoString(record.createdAt),
    };
  }
}
