import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DisciplineReward,
  DisciplineRewardType,
} from './entities/discipline-reward.entity';

/** Chỉ chứa TypeORM query (CLAUDE.md §Kiến trúc module). */
@Injectable()
export class DisciplinesRewardsRepository {
  constructor(
    @InjectRepository(DisciplineReward)
    private readonly repository: Repository<DisciplineReward>,
  ) {}

  /** Toàn bộ quyết định của một nhân viên, mới nhất trước. Không phân trang. */
  findByEmployee(
    employeeId: number,
    type?: DisciplineRewardType,
  ): Promise<DisciplineReward[]> {
    const query = this.repository
      .createQueryBuilder('record')
      .leftJoinAndSelect('record.issuer', 'issuer')
      .where('record.employeeId = :employeeId', { employeeId })
      .orderBy('record.decisionDate', 'DESC')
      .addOrderBy('record.id', 'DESC');

    if (type !== undefined) {
      query.andWhere('record.type = :type', { type });
    }

    return query.getMany();
  }

  findById(id: number): Promise<DisciplineReward | null> {
    return this.repository.findOne({
      where: { id },
      relations: { employee: true, issuer: true },
    });
  }

  create(data: Partial<DisciplineReward>): Promise<DisciplineReward> {
    return this.repository.save(this.repository.create(data));
  }

  save(record: DisciplineReward): Promise<DisciplineReward> {
    return this.repository.save(record);
  }

  remove(id: number): Promise<unknown> {
    return this.repository.delete(id);
  }
}
