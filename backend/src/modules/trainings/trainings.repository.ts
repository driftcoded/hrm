import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FilterTrainingDto } from './dto/filter-training.dto';
import { EmployeeTraining } from './entities/employee-training.entity';
import { Training } from './entities/training.entity';

export interface FindTrainingsOptions extends FilterTrainingDto {
  skip: number;
  take: number;
}

/** Chỉ chứa TypeORM query (CLAUDE.md §Kiến trúc module). */
@Injectable()
export class TrainingsRepository {
  constructor(
    @InjectRepository(Training)
    private readonly trainings: Repository<Training>,
    @InjectRepository(EmployeeTraining)
    private readonly participants: Repository<EmployeeTraining>,
  ) {}

  findPaginated(options: FindTrainingsOptions): Promise<[Training[], number]> {
    const query = this.trainings
      .createQueryBuilder('training')
      // Khoá có ngày lên trước (MySQL không có `NULLS LAST`), mới nhất trước.
      .orderBy('training.startDate IS NULL', 'ASC')
      .addOrderBy('training.startDate', 'DESC')
      .addOrderBy('training.id', 'DESC')
      .skip(options.skip)
      .take(options.take);

    if (options.status !== undefined) {
      query.andWhere('training.status = :status', { status: options.status });
    }

    if (options.type !== undefined) {
      query.andWhere('training.type = :type', { type: options.type });
    }

    if (options.search) {
      query.andWhere(
        '(training.code LIKE :search OR training.name LIKE :search)',
        {
          search: `%${options.search}%`,
        },
      );
    }

    return query.getManyAndCount();
  }

  findById(id: number): Promise<Training | null> {
    return this.trainings.findOne({ where: { id } });
  }

  findByCode(code: string): Promise<Training | null> {
    return this.trainings.findOne({ where: { code } });
  }

  createTraining(data: Partial<Training>): Promise<Training> {
    return this.trainings.save(this.trainings.create(data));
  }

  saveTraining(training: Training): Promise<Training> {
    return this.trainings.save(training);
  }

  removeTraining(id: number): Promise<unknown> {
    return this.trainings.delete(id);
  }

  // ------------------------------------------------------ người tham gia ----

  findParticipants(trainingId: number): Promise<EmployeeTraining[]> {
    return this.participants.find({
      where: { trainingId },
      relations: { employee: { department: true } },
      order: { id: 'ASC' },
    });
  }

  /** Số người của một khoá. */
  countParticipants(trainingId: number): Promise<number> {
    return this.participants.count({ where: { trainingId } });
  }

  /** Số người của nhiều khoá trong một query. */
  async countByTrainings(trainingIds: number[]): Promise<Map<number, number>> {
    if (trainingIds.length === 0) {
      return new Map();
    }

    const rows: { trainingId: string; total: string }[] =
      await this.participants
        .createQueryBuilder('participant')
        .select('participant.trainingId', 'trainingId')
        .addSelect('COUNT(*)', 'total')
        .where('participant.trainingId IN (:...trainingIds)', { trainingIds })
        .groupBy('participant.trainingId')
        .getRawMany();

    return new Map(
      rows.map((row) => [Number(row.trainingId), Number(row.total)]),
    );
  }

  findEnrolled(
    trainingId: number,
    employeeIds: number[],
  ): Promise<EmployeeTraining[]> {
    if (employeeIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.participants.find({
      where: { trainingId, employeeId: In(employeeIds) },
      relations: { employee: true },
    });
  }

  findParticipant(
    trainingId: number,
    employeeId: number,
  ): Promise<EmployeeTraining | null> {
    return this.participants.findOne({
      where: { trainingId, employeeId },
      relations: { employee: { department: true } },
    });
  }

  enroll(rows: Partial<EmployeeTraining>[]): Promise<EmployeeTraining[]> {
    return this.participants.save(this.participants.create(rows));
  }

  saveParticipant(row: EmployeeTraining): Promise<EmployeeTraining> {
    return this.participants.save(row);
  }

  removeParticipant(id: number): Promise<unknown> {
    return this.participants.delete(id);
  }

  /** Lịch sử đào tạo của một nhân viên — dùng cho tab trong hồ sơ. */
  findByEmployee(employeeId: number): Promise<EmployeeTraining[]> {
    return this.participants.find({
      where: { employeeId },
      relations: { training: true },
      order: { id: 'DESC' },
    });
  }
}
