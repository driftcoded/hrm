import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import {
  toDateOnlyString,
  toIsoString,
  todayDateString,
} from '@/common/utils/date.util';
import { resolvePagination } from '@/common/utils/pagination.util';
import { EmployeesService } from '@/modules/employees/employees.service';
import { CompleteTrainingDto } from './dto/complete-training.dto';
import { CreateTrainingDto } from './dto/create-training.dto';
import { EnrollEmployeesDto } from './dto/enroll-employees.dto';
import { FilterTrainingDto } from './dto/filter-training.dto';
import {
  EnrollResultDto,
  TrainingParticipantDto,
  TrainingResponseDto,
} from './dto/training-response.dto';
import { UpdateTrainingDto } from './dto/update-training.dto';
import { EmployeeTraining } from './entities/employee-training.entity';
import { Training, TrainingStatus } from './entities/training.entity';
import { TrainingsRepository } from './trainings.repository';

/** Bước chuyển trạng thái hợp lệ của một khoá học. `completed` và `cancelled` là điểm cuối. */
const ALLOWED_TRANSITIONS: Record<TrainingStatus, TrainingStatus[]> = {
  [TrainingStatus.PLANNED]: [
    TrainingStatus.ONGOING,
    TrainingStatus.COMPLETED,
    TrainingStatus.CANCELLED,
  ],
  [TrainingStatus.ONGOING]: [
    TrainingStatus.COMPLETED,
    TrainingStatus.CANCELLED,
  ],
  [TrainingStatus.COMPLETED]: [],
  [TrainingStatus.CANCELLED]: [],
};

/** Đào tạo (PLAN 7.1). Nhân sự ghi danh; nhân viên không tự đăng ký. */
@Injectable()
export class TrainingsService {
  private readonly logger = new Logger(TrainingsService.name);

  constructor(
    private readonly repository: TrainingsRepository,
    private readonly employeesService: EmployeesService,
  ) {}

  // ---------------------------------------------------------- khoá học ----

  async findAll(
    filter: FilterTrainingDto,
  ): Promise<PaginatedResponseDto<TrainingResponseDto>> {
    const { page, limit, skip } = resolvePagination(filter);

    const [trainings, total] = await this.repository.findPaginated({
      ...filter,
      skip,
      take: limit,
    });

    // Một query đếm cho cả trang, không phải mỗi khoá một query.
    const counts = await this.repository.countByTrainings(
      trainings.map((training) => Number(training.id)),
    );

    return new PaginatedResponseDto(
      trainings.map((training) =>
        this.toResponse(training, counts.get(Number(training.id)) ?? 0),
      ),
      total,
      page,
      limit,
    );
  }

  async findOne(id: number): Promise<TrainingResponseDto> {
    const training = await this.getExistingOrThrow(id);

    return this.toResponse(
      training,
      await this.repository.countParticipants(id),
    );
  }

  async create(
    dto: CreateTrainingDto,
    user: AuthenticatedUser,
  ): Promise<TrainingResponseDto> {
    const code = dto.code.trim().toUpperCase();

    if (await this.repository.findByCode(code)) {
      throw new ConflictException({
        code: 'TRAINING_CODE_TAKEN',
        message: `Training code "${code}" is already used`,
      });
    }

    this.assertDatesOrdered(dto.startDate ?? null, dto.endDate ?? null);

    const created = await this.repository.createTraining({
      code,
      name: dto.name.trim(),
      type: dto.type,
      description: dto.description?.trim() || null,
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
      location: dto.location?.trim() || null,
      trainer: dto.trainer?.trim() || null,
      cost: (dto.cost ?? 0).toFixed(2),
      maxParticipants: dto.maxParticipants ?? null,
      status: TrainingStatus.PLANNED,
      attachmentUrl: dto.attachmentUrl?.trim() || null,
      note: dto.note?.trim() || null,
      createdBy: user.userId,
    });

    return this.toResponse(created, 0);
  }

  async update(
    id: number,
    dto: UpdateTrainingDto,
  ): Promise<TrainingResponseDto> {
    const training = await this.getExistingOrThrow(id);

    if (dto.status !== undefined && dto.status !== training.status) {
      this.assertTransition(training.status, dto.status);
      training.status = dto.status;
    }

    if (dto.code !== undefined) {
      const code = dto.code.trim().toUpperCase();
      const clash = await this.repository.findByCode(code);

      if (clash && Number(clash.id) !== id) {
        throw new ConflictException({
          code: 'TRAINING_CODE_TAKEN',
          message: `Training code "${code}" is already used`,
        });
      }

      training.code = code;
    }

    if (dto.name !== undefined) {
      training.name = dto.name.trim();
    }
    if (dto.type !== undefined) {
      training.type = dto.type;
    }
    if (dto.description !== undefined) {
      training.description = dto.description.trim() || null;
    }
    if (dto.startDate !== undefined) {
      training.startDate = dto.startDate;
    }
    if (dto.endDate !== undefined) {
      training.endDate = dto.endDate;
    }
    if (dto.location !== undefined) {
      training.location = dto.location.trim() || null;
    }
    if (dto.trainer !== undefined) {
      training.trainer = dto.trainer.trim() || null;
    }
    if (dto.cost !== undefined) {
      training.cost = dto.cost.toFixed(2);
    }
    if (dto.attachmentUrl !== undefined) {
      training.attachmentUrl = dto.attachmentUrl.trim() || null;
    }
    if (dto.note !== undefined) {
      training.note = dto.note.trim() || null;
    }

    this.assertDatesOrdered(
      training.startDate === null ? null : toDateOnlyString(training.startDate),
      training.endDate === null ? null : toDateOnlyString(training.endDate),
    );

    // Không hạ sức chứa xuống dưới số người đã ghi danh.
    if (dto.maxParticipants !== undefined) {
      const enrolled = await this.repository.countParticipants(id);

      if (dto.maxParticipants < enrolled) {
        throw new UnprocessableEntityException({
          code: 'TRAINING_CAPACITY_BELOW_ENROLLED',
          message: `Training ${id} already has ${enrolled} participants; the cap cannot be set to ${dto.maxParticipants}`,
        });
      }

      training.maxParticipants = dto.maxParticipants;
    }

    await this.repository.saveTraining(training);

    return this.findOne(id);
  }

  async remove(id: number): Promise<{ id: number; deleted: boolean }> {
    await this.getExistingOrThrow(id);

    // FK là ON DELETE CASCADE nên xoá khoá sẽ kéo theo lịch sử đào tạo của người học.
    const enrolled = await this.repository.countParticipants(id);

    if (enrolled > 0) {
      throw new UnprocessableEntityException({
        code: 'TRAINING_HAS_PARTICIPANTS',
        message: `Training ${id} has ${enrolled} participants; cancel it instead of deleting it`,
      });
    }

    await this.repository.removeTraining(id);

    return { id, deleted: true };
  }

  // ----------------------------------------------------- người tham gia ----

  async findParticipants(id: number): Promise<TrainingParticipantDto[]> {
    await this.getExistingOrThrow(id);

    const rows = await this.repository.findParticipants(id);

    return rows.map((row) => this.toParticipant(row));
  }

  /**
   * Ghi danh một danh sách nhân viên vào khoá.
   *
   * Người đã có trong khoá bị bỏ qua và trả về ở `alreadyEnrolled`.
   */
  async enroll(
    id: number,
    dto: EnrollEmployeesDto,
    user: AuthenticatedUser,
  ): Promise<EnrollResultDto> {
    const training = await this.getExistingOrThrow(id);

    if (
      training.status === TrainingStatus.COMPLETED ||
      training.status === TrainingStatus.CANCELLED
    ) {
      throw new ConflictException({
        code: 'TRAINING_CLOSED',
        message: `Training ${id} is "${training.status}" and no longer accepts participants`,
      });
    }

    const unique = [...new Set(dto.employeeIds)];

    // Ném EMPLOYEE_NOT_FOUND / FORBIDDEN theo đúng phạm vi của người gọi.
    for (const employeeId of unique) {
      await this.employeesService.findOne(employeeId, user);
    }

    const existing = await this.repository.findEnrolled(id, unique);
    const existingIds = new Set(existing.map((row) => Number(row.employeeId)));
    const toEnroll = unique.filter(
      (employeeId) => !existingIds.has(employeeId),
    );

    if (training.maxParticipants !== null) {
      const enrolled = await this.repository.countParticipants(id);

      if (enrolled + toEnroll.length > training.maxParticipants) {
        throw new UnprocessableEntityException({
          code: 'TRAINING_FULL',
          message: `Training ${id} takes ${training.maxParticipants} participants; it has ${enrolled} and ${toEnroll.length} more were requested`,
        });
      }
    }

    if (toEnroll.length > 0) {
      await this.repository.enroll(
        toEnroll.map((employeeId) => ({
          employeeId,
          trainingId: id,
          // Ngày ghi danh là ngày ghi, không phải ngày khai giảng.
          registrationDate: todayDateString(),
        })),
      );

      this.logger.log(
        `${toEnroll.length} employee(s) enrolled on training ${id} by user ${user.userId}`,
      );
    }

    return {
      enrolled: toEnroll.length,
      alreadyEnrolled: existing.map(
        (row) => row.employee?.employeeCode ?? String(row.employeeId),
      ),
    };
  }

  /** Ghi kết quả học của một người. */
  async complete(
    id: number,
    employeeId: number,
    dto: CompleteTrainingDto,
  ): Promise<TrainingParticipantDto> {
    const training = await this.getExistingOrThrow(id);
    const participant = await this.repository.findParticipant(id, employeeId);

    if (!participant) {
      throw new NotFoundException({
        code: 'TRAINING_PARTICIPANT_NOT_FOUND',
        message: `Employee ${employeeId} is not enrolled on training ${id}`,
      });
    }

    participant.result = dto.result;
    participant.completionDate =
      dto.completionDate ??
      (training.endDate === null
        ? todayDateString()
        : toDateOnlyString(training.endDate));
    participant.score = dto.score === undefined ? null : dto.score.toFixed(2);

    if (dto.certificateUrl !== undefined) {
      participant.certificateUrl = dto.certificateUrl.trim() || null;
    }
    if (dto.note !== undefined) {
      participant.note = dto.note.trim() || null;
    }

    await this.repository.saveParticipant(participant);

    const saved = await this.repository.findParticipant(id, employeeId);

    return this.toParticipant(saved as EmployeeTraining);
  }

  /** Gỡ một người khỏi khoá — chỉ khi chưa có kết quả. */
  async unenroll(
    id: number,
    employeeId: number,
  ): Promise<{ id: number; deleted: boolean }> {
    await this.getExistingOrThrow(id);

    const participant = await this.repository.findParticipant(id, employeeId);

    if (!participant) {
      throw new NotFoundException({
        code: 'TRAINING_PARTICIPANT_NOT_FOUND',
        message: `Employee ${employeeId} is not enrolled on training ${id}`,
      });
    }

    // Đã có kết quả thì không gỡ — đó là một dòng lịch sử đào tạo.
    if (participant.result !== null) {
      throw new UnprocessableEntityException({
        code: 'TRAINING_RESULT_RECORDED',
        message: `Employee ${employeeId} already has a result on training ${id} and cannot be removed from it`,
      });
    }

    await this.repository.removeParticipant(Number(participant.id));

    return { id: Number(participant.id), deleted: true };
  }

  /** Lịch sử đào tạo của một nhân viên — cho tab trong hồ sơ. */
  async findByEmployee(
    employeeId: number,
    user: AuthenticatedUser,
  ): Promise<TrainingParticipantDto[]> {
    await this.employeesService.findOne(employeeId, user);

    const rows = await this.repository.findByEmployee(employeeId);

    return rows.map((row) => this.toParticipant(row));
  }

  // --------------------------------------------------------- nội bộ ----

  private assertTransition(from: TrainingStatus, to: TrainingStatus): void {
    if (!ALLOWED_TRANSITIONS[from].includes(to)) {
      throw new ConflictException({
        code: 'TRAINING_INVALID_TRANSITION',
        message: `A training cannot go from "${from}" to "${to}"`,
      });
    }
  }

  private assertDatesOrdered(
    startDate: string | null,
    endDate: string | null,
  ): void {
    if (startDate !== null && endDate !== null && endDate < startDate) {
      throw new UnprocessableEntityException({
        code: 'INVALID_TRAINING_RANGE',
        message: `end date (${endDate}) is before start date (${startDate})`,
      });
    }
  }

  private async getExistingOrThrow(id: number): Promise<Training> {
    const training = await this.repository.findById(id);

    if (!training) {
      throw new NotFoundException({
        code: 'TRAINING_NOT_FOUND',
        message: `Training ${id} not found`,
      });
    }

    return training;
  }

  private toResponse(
    training: Training,
    participantCount: number,
  ): TrainingResponseDto {
    return {
      id: Number(training.id),
      code: training.code,
      name: training.name,
      type: training.type,
      description: training.description,
      startDate:
        training.startDate === null
          ? null
          : toDateOnlyString(training.startDate),
      endDate:
        training.endDate === null ? null : toDateOnlyString(training.endDate),
      location: training.location,
      trainer: training.trainer,
      cost: Number(training.cost),
      maxParticipants: training.maxParticipants,
      participantCount,
      status: training.status,
      attachmentUrl: training.attachmentUrl,
      note: training.note,
      createdAt: toIsoString(training.createdAt),
    };
  }

  private toParticipant(row: EmployeeTraining): TrainingParticipantDto {
    return {
      // Chỉ kèm khoá học khi quan hệ đã được load — `GET /employees/:id/trainings`.
      training: row.training
        ? {
            id: Number(row.training.id),
            code: row.training.code,
            name: row.training.name,
            type: row.training.type,
            startDate:
              row.training.startDate === null
                ? null
                : toDateOnlyString(row.training.startDate),
            endDate:
              row.training.endDate === null
                ? null
                : toDateOnlyString(row.training.endDate),
          }
        : undefined,
      id: Number(row.id),
      employeeId: Number(row.employeeId),
      employeeCode: row.employee?.employeeCode ?? '',
      fullName: row.employee?.fullName ?? '',
      departmentName: row.employee?.department?.name ?? null,
      registrationDate: toDateOnlyString(row.registrationDate),
      completionDate:
        row.completionDate === null
          ? null
          : toDateOnlyString(row.completionDate),
      result: row.result,
      score: row.score === null ? null : Number(row.score),
      certificateUrl: row.certificateUrl,
      note: row.note,
    };
  }
}
