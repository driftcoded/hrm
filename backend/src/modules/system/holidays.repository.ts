import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Holiday, HolidayType } from './entities/holiday.entity';
import { HolidaySortKey } from './dto/filter-holiday.dto';

/** Maps `sort` (whitelisted in FilterHolidayDto) to a safe SQL column. */
const SORT_COLUMNS: Record<HolidaySortKey, string> = {
  holidayDate: 'holiday.holidayDate',
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
  isPaid?: boolean;
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
      query.andWhere('holiday.year = :year', { year: options.year });
    }

    if (options.type !== undefined) {
      query.andWhere('holiday.type = :type', { type: options.type });
    }

    if (options.isPaid !== undefined) {
      query.andWhere('holiday.isPaid = :isPaid', { isPaid: options.isPaid });
    }

    if (options.search) {
      query.andWhere('holiday.name LIKE :search', {
        search: `%${options.search}%`,
      });
    }

    return query.getManyAndCount();
  }

  /** All holidays for a given year, unpaginated (used by `GET /system/holidays`). */
  findByYear(year: number): Promise<Holiday[]> {
    return this.repository
      .createQueryBuilder('holiday')
      .where('holiday.year = :year', { year })
      .orderBy('holiday.holidayDate', 'ASC')
      .getMany();
  }

  findById(id: number): Promise<Holiday | null> {
    return this.repository
      .createQueryBuilder('holiday')
      .where('holiday.id = :id', { id })
      .getOne();
  }

  /** Holiday lookup by date; `exceptId` excludes the record currently being updated (for uniqueness checks). */
  findByDate(holidayDate: string, exceptId?: number): Promise<Holiday | null> {
    return this.repository.findOne({
      where:
        exceptId === undefined
          ? { holidayDate }
          : { holidayDate, id: Not(exceptId) },
    });
  }

  create(data: Partial<Holiday>): Promise<Holiday> {
    return this.repository.save(this.repository.create(data));
  }

  async update(id: number, data: Partial<Holiday>): Promise<void> {
    await this.repository.update({ id }, data);
  }

  /** Hard delete: the `holidays` table has no `deleted_at` column (schema §5.5). */
  async delete(id: number): Promise<void> {
    await this.repository.delete({ id });
  }
}
