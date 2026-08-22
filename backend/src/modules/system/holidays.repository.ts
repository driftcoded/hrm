import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Holiday, HolidayType } from './entities/holiday.entity';
import { HolidaySortKey } from './dto/filter-holiday.dto';

/** Maps `sort` (whitelisted in FilterHolidayDto) to a safe SQL column. */
const SORT_COLUMNS: Record<HolidaySortKey, string> = {
  sortOrder: 'holiday.sortOrder',
  name: 'holiday.name',
  year: 'holiday.year',
};

export interface FindHolidaysOptions {
  skip: number;
  take: number;
  sort: HolidaySortKey;
  order: 'ASC' | 'DESC';
  year?: number;
  type?: HolidayType;
  isActive?: boolean;
  search?: string;
}

/** TypeORM queries only (CLAUDE.md §Module architecture). */
@Injectable()
export class HolidaysRepository {
  constructor(
    @InjectRepository(Holiday)
    private readonly repository: Repository<Holiday>,
  ) {}

  findPaginated(options: FindHolidaysOptions): Promise<[Holiday[], number]> {
    const query = this.repository
      .createQueryBuilder('holiday')
      .orderBy(SORT_COLUMNS[options.sort], options.order)
      .addOrderBy('holiday.id', 'ASC')
      .skip(options.skip)
      .take(options.take);

    if (options.year !== undefined) {
      // Định nghĩa mọi năm cũng có hiệu lực trong năm được lọc.
      query.andWhere('(holiday.year = :year OR holiday.year IS NULL)', {
        year: options.year,
      });
    }

    if (options.type !== undefined) {
      query.andWhere('holiday.type = :type', { type: options.type });
    }

    if (options.isActive !== undefined) {
      query.andWhere('holiday.isActive = :isActive', {
        isActive: options.isActive,
      });
    }

    if (options.search) {
      query.andWhere(
        '(holiday.name LIKE :search OR holiday.code LIKE :search)',
        {
          search: `%${options.search}%`,
        },
      );
    }

    return query.getManyAndCount();
  }

  /** Mọi định nghĩa đang bật — đầu vào để suy ra lịch của một năm bất kỳ. */
  findActiveRules(): Promise<Holiday[]> {
    return this.repository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  findAllRules(): Promise<Holiday[]> {
    return this.repository.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  findById(id: number): Promise<Holiday | null> {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * Định nghĩa trùng `(code, year)`; `exceptId` bỏ qua bản ghi đang sửa.
   *
   * `year IS NULL` phải so bằng `IsNull()` — trong SQL `NULL = NULL` là không
   * xác định, nên ràng buộc UNIQUE một mình không chặn được hai dòng mọi năm
   * cùng `code`.
   */
  findByCodeAndYear(
    code: string,
    year: number | null,
    exceptId?: number,
  ): Promise<Holiday | null> {
    return this.repository.findOne({
      where: {
        code,
        year: year === null ? IsNull() : year,
        ...(exceptId === undefined ? {} : { id: Not(exceptId) }),
      },
    });
  }

  create(data: Partial<Holiday>): Promise<Holiday> {
    return this.repository.save(this.repository.create(data));
  }

  async update(id: number, data: Partial<Holiday>): Promise<void> {
    await this.repository.update({ id }, data);
  }

  /** Hard delete: the `holidays` table has no `deleted_at` column. */
  async delete(id: number): Promise<void> {
    await this.repository.delete({ id });
  }
}
