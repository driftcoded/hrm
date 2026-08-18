import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import {
  currentYearInVietnam,
  toDateOnlyString,
  yearOfDateString,
} from '@/common/utils/date.util';
import { resolvePagination } from '@/common/utils/pagination.util';
import { rejectUnexpectedNulls } from '@/common/utils/reject-null.util';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { FilterHolidayDto } from './dto/filter-holiday.dto';
import { HolidayResponseDto } from './dto/holiday-response.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { Holiday, HolidayType } from './entities/holiday.entity';
import { HolidaysRepository } from './holidays.repository';

/**
 * All business logic for the holiday calendar (CLAUDE.md §Module architecture).
 *
 * Note: the `holidays` table has NO "recurring yearly" column (schema §5.5 only
 * has name/holiday_date/type/year/is_paid/note) — most Vietnamese holidays follow
 * the lunar calendar, so each year has to be seeded/entered separately. Filtering
 * by `year` stands in for that flag.
 */
@Injectable()
export class HolidaysService {
  constructor(private readonly holidaysRepository: HolidaysRepository) {}

  async findAll(
    filter: FilterHolidayDto,
  ): Promise<PaginatedResponseDto<HolidayResponseDto>> {
    const { page, limit, skip } = resolvePagination(filter);
    const search = filter.search?.trim();

    const [holidays, total] = await this.holidaysRepository.findPaginated({
      skip,
      take: limit,
      sort: filter.sort ?? 'holidayDate',
      order: filter.order === 'desc' ? 'DESC' : 'ASC',
      year: filter.year,
      type: filter.type,
      isPaid: filter.isPaid,
      search: search && search.length > 0 ? search : undefined,
    });

    return new PaginatedResponseDto(
      holidays.map((holiday) => this.toResponse(holiday)),
      total,
      page,
      limit,
    );
  }

  /**
   * Flat list for a given year – used by `GET /system/holidays?year=`.
   * The default `year` is resolved using Vietnam time (UTC+7), NOT the
   * server's `new Date().getFullYear()` (the server's timezone may be UTC,
   * which would be off by a year during the ~7-hour window around New Year's
   * midnight).
   */
  async findByYear(year?: number): Promise<HolidayResponseDto[]> {
    const holidays = await this.holidaysRepository.findByYear(
      year ?? currentYearInVietnam(),
    );

    return holidays.map((holiday) => this.toResponse(holiday));
  }

  async findOne(id: number): Promise<HolidayResponseDto> {
    return this.toResponse(await this.getExistingOrThrow(id));
  }

  async create(dto: CreateHolidayDto): Promise<HolidayResponseDto> {
    await this.assertDateAvailable(dto.holidayDate);

    const created = await this.holidaysRepository.create({
      name: dto.name.trim(),
      holidayDate: dto.holidayDate,
      // `year` is always derived from `holidayDate` so the two columns never drift apart.
      year: yearOfDateString(dto.holidayDate),
      type: dto.type ?? HolidayType.NATIONAL,
      isPaid: dto.isPaid ?? true,
      note: dto.note ?? null,
    });

    return this.findOne(Number(created.id));
  }

  async update(id: number, dto: UpdateHolidayDto): Promise<HolidayResponseDto> {
    await this.getExistingOrThrow(id);
    rejectUnexpectedNulls(dto, ['note']);
    const patch: Partial<Holiday> = {};

    if (dto.name !== undefined) {
      patch.name = dto.name.trim();
    }

    if (dto.holidayDate !== undefined) {
      await this.assertDateAvailable(dto.holidayDate, id);
      patch.holidayDate = dto.holidayDate;
      patch.year = yearOfDateString(dto.holidayDate);
    }

    if (dto.type !== undefined) {
      patch.type = dto.type;
    }

    if (dto.isPaid !== undefined) {
      patch.isPaid = dto.isPaid;
    }

    if (dto.note !== undefined) {
      patch.note = dto.note ?? null;
    }

    if (Object.keys(patch).length > 0) {
      await this.holidaysRepository.update(id, patch);
    }

    return this.findOne(id);
  }

  /** Hard delete (table has no `deleted_at`); no other table references holidays. */
  async remove(id: number): Promise<{ id: number; deleted: boolean }> {
    await this.getExistingOrThrow(id);
    await this.holidaysRepository.delete(id);

    return { id, deleted: true };
  }

  // ------------------------------------------------------------ internals ----

  private async getExistingOrThrow(id: number): Promise<Holiday> {
    const holiday = await this.holidaysRepository.findById(id);

    if (!holiday) {
      throw new NotFoundException({
        code: 'HOLIDAY_NOT_FOUND',
        message: `Cannot find holiday with id ${id}`,
      });
    }

    return holiday;
  }

  private async assertDateAvailable(
    holidayDate: string,
    exceptId?: number,
  ): Promise<void> {
    const existing = await this.holidaysRepository.findByDate(
      holidayDate,
      exceptId,
    );

    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_HOLIDAY_DATE',
        message: `A holiday already exists on ${holidayDate}`,
      });
    }
  }

  private toResponse(holiday: Holiday): HolidayResponseDto {
    return {
      id: Number(holiday.id),
      name: holiday.name,
      holidayDate: toDateOnlyString(holiday.holidayDate),
      type: holiday.type,
      year: Number(holiday.year),
      isPaid: Boolean(holiday.isPaid),
      note: holiday.note ?? null,
    };
  }
}
