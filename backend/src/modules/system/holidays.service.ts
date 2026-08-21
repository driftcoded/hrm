import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { currentYearInVietnam } from '@/common/utils/date.util';
import { resolvePagination } from '@/common/utils/pagination.util';
import { rejectUnexpectedNulls } from '@/common/utils/reject-null.util';
import {
  resolveHolidays,
  type HolidayRule,
} from '@/common/utils/vietnam-holidays.util';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { FilterHolidayDto } from './dto/filter-holiday.dto';
import {
  GenerateHolidaysDto,
  GenerateHolidaysResultDto,
} from './dto/generate-holidays.dto';
import {
  HolidayDateDto,
  HolidayResponseDto,
} from './dto/holiday-response.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { Holiday, HolidayCalendar, HolidayType } from './entities/holiday.entity';
import { HolidaysRepository } from './holidays.repository';

/**
 * Ngày lễ được khai một lần dưới dạng ĐỊNH NGHĨA, lịch của từng năm suy ra sau.
 *
 * `findAll` / `create` / `update` / `remove` làm việc với định nghĩa — sáu dòng
 * cho toàn bộ ngày lễ pháp định, gần như không đổi.
 *
 * `findByYear` trả về NGÀY CỤ THỂ đã tính cho năm đó. Chấm công, nghỉ phép và
 * bảng lương đều đọc qua hàm này, nên đổi cách lưu trữ bên dưới không đụng tới
 * ba phân hệ đó.
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
      sort: filter.sort ?? 'sortOrder',
      order: filter.order === 'desc' ? 'DESC' : 'ASC',
      year: filter.year,
      type: filter.type,
      isActive: filter.isActive,
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
   * Lịch nghỉ đã tính của một năm, sắp theo ngày.
   *
   * Năm mặc định lấy theo giờ Việt Nam (UTC+7) chứ không phải
   * `new Date().getFullYear()` của máy chủ: máy chạy giờ UTC sẽ lệch một năm
   * trong khoảng bảy tiếng quanh giao thừa.
   */
  async findByYear(year?: number): Promise<HolidayDateDto[]> {
    const target = year ?? currentYearInVietnam();
    const rules = await this.holidaysRepository.findActiveRules();

    return resolveHolidays(rules.map((rule) => this.toRule(rule)), target).map(
      (holiday) => ({
        holidayDate: holiday.date,
        code: holiday.code,
        name: holiday.name,
        type: holiday.type as HolidayType,
        year: target,
        isPaid: holiday.isPaid,
        dayIndex: holiday.dayIndex,
        dayCount: holiday.dayCount,
        isCompensatory: holiday.isCompensatory,
        note: holiday.note,
      }),
    );
  }

  async findOne(id: number): Promise<HolidayResponseDto> {
    return this.toResponse(await this.getExistingOrThrow(id));
  }

  async create(dto: CreateHolidayDto): Promise<HolidayResponseDto> {
    const year = dto.year ?? null;
    await this.assertCodeAvailable(dto.code, year);

    const created = await this.holidaysRepository.create({
      code: dto.code.trim(),
      name: dto.name.trim(),
      type: dto.type ?? HolidayType.NATIONAL,
      calendar: dto.calendar ?? HolidayCalendar.SOLAR,
      month: dto.month,
      day: dto.day,
      offsetDays: dto.offsetDays ?? 0,
      durationDays: dto.durationDays ?? 1,
      year,
      isPaid: dto.isPaid ?? true,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
      note: dto.note ?? null,
    });

    return this.findOne(Number(created.id));
  }

  async update(id: number, dto: UpdateHolidayDto): Promise<HolidayResponseDto> {
    const existing = await this.getExistingOrThrow(id);
    rejectUnexpectedNulls(dto, ['note', 'year']);
    const patch: Partial<Holiday> = {};

    const nextCode = dto.code?.trim() ?? existing.code;
    const nextYear = dto.year === undefined ? existing.year : dto.year;

    if (nextCode !== existing.code || nextYear !== existing.year) {
      await this.assertCodeAvailable(nextCode, nextYear, id);
      patch.code = nextCode;
      patch.year = nextYear;
    }

    if (dto.name !== undefined) {
      patch.name = dto.name.trim();
    }

    for (const key of [
      'type',
      'calendar',
      'month',
      'day',
      'offsetDays',
      'durationDays',
      'isPaid',
      'isActive',
      'sortOrder',
    ] as const) {
      if (dto[key] !== undefined) {
        Object.assign(patch, { [key]: dto[key] });
      }
    }

    if (dto.note !== undefined) {
      patch.note = dto.note ?? null;
    }

    if (Object.keys(patch).length > 0) {
      await this.holidaysRepository.update(id, patch);
    }

    return this.findOne(id);
  }

  async generate(dto: GenerateHolidaysDto): Promise<GenerateHolidaysResultDto> {
    const allRules = await this.holidaysRepository.findActiveRules();
    const baseRules = allRules.map((r) => this.toRule(r));

    const merged = baseRules.map((rule) => {
      if (rule.code === 'TET' && dto.tetDaysBefore !== undefined) {
        return { ...rule, offsetDays: -dto.tetDaysBefore, year: dto.year };
      }
      if (rule.code === 'NATIONAL_DAY' && dto.nationalDayExtra !== undefined) {
        return {
          ...rule,
          offsetDays: dto.nationalDayExtra === 'before' ? -1 : 0,
          year: dto.year,
        };
      }
      return rule;
    });

    const resolved = resolveHolidays(merged, dto.year, {
      compensateWeekends: dto.compensateWeekends ?? true,
    });

    const holidays: HolidayDateDto[] = resolved.map((h) => ({
      holidayDate: h.date,
      code: h.code,
      name: h.name,
      type: h.type as HolidayType,
      year: dto.year,
      isPaid: h.isPaid,
      dayIndex: h.dayIndex,
      dayCount: h.dayCount,
      isCompensatory: h.isCompensatory,
      note: h.note,
    }));

    let created = 0;
    let skipped = 0;

    if (!dto.preview) {
      if (dto.tetDaysBefore !== undefined) {
        const clash = await this.holidaysRepository.findByCodeAndYear('TET', dto.year);
        if (clash) {
          skipped++;
        } else {
          const base = allRules.find((r) => r.code === 'TET' && r.year === null);
          if (base) {
            await this.holidaysRepository.create({
              code: base.code,
              name: base.name,
              type: base.type,
              calendar: base.calendar,
              month: base.month,
              day: base.day,
              offsetDays: -dto.tetDaysBefore,
              durationDays: base.durationDays,
              year: dto.year,
              isPaid: base.isPaid,
              isActive: base.isActive,
              sortOrder: base.sortOrder,
              note: base.note,
            });
            created++;
          }
        }
      }

      if (dto.nationalDayExtra !== undefined) {
        const clash = await this.holidaysRepository.findByCodeAndYear('NATIONAL_DAY', dto.year);
        if (clash) {
          skipped++;
        } else {
          const base = allRules.find((r) => r.code === 'NATIONAL_DAY' && r.year === null);
          if (base) {
            await this.holidaysRepository.create({
              code: base.code,
              name: base.name,
              type: base.type,
              calendar: base.calendar,
              month: base.month,
              day: base.day,
              offsetDays: dto.nationalDayExtra === 'before' ? -1 : 0,
              durationDays: base.durationDays,
              year: dto.year,
              isPaid: base.isPaid,
              isActive: base.isActive,
              sortOrder: base.sortOrder,
              note: base.note,
            });
            created++;
          }
        }
      }
    }

    return { year: dto.year, created, skipped, preview: dto.preview ?? false, holidays };
  }

  /** Hard delete (table has no `deleted_at`); no other table references holidays. */
  async remove(id: number): Promise<{ id: number; deleted: boolean }> {
    await this.getExistingOrThrow(id);
    await this.holidaysRepository.delete(id);

    return { id, deleted: true };
  }

  // ------------------------------------------------------------ internals ----

  private toRule(holiday: Holiday): HolidayRule {
    return {
      code: holiday.code,
      name: holiday.name,
      type: holiday.type,
      calendar: holiday.calendar,
      month: holiday.month,
      day: holiday.day,
      offsetDays: holiday.offsetDays,
      durationDays: holiday.durationDays,
      year: holiday.year,
      isPaid: holiday.isPaid,
      isActive: holiday.isActive,
      sortOrder: holiday.sortOrder,
      note: holiday.note,
    };
  }

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

  /** Một `code` chỉ được có một dòng mọi năm và tối đa một dòng cho mỗi năm. */
  private async assertCodeAvailable(
    code: string,
    year: number | null,
    exceptId?: number,
  ): Promise<void> {
    const clash = await this.holidaysRepository.findByCodeAndYear(
      code,
      year,
      exceptId,
    );

    if (clash) {
      throw new ConflictException({
        code: 'DUPLICATE_HOLIDAY_CODE',
        message: `Holiday "${code}" already has a definition for ${year === null ? 'every year' : year}`,
      });
    }
  }

  private toResponse(holiday: Holiday): HolidayResponseDto {
    return {
      id: Number(holiday.id),
      code: holiday.code,
      name: holiday.name,
      type: holiday.type,
      calendar: holiday.calendar,
      month: holiday.month,
      day: holiday.day,
      offsetDays: holiday.offsetDays,
      durationDays: holiday.durationDays,
      year: holiday.year,
      isPaid: holiday.isPaid,
      isActive: holiday.isActive,
      sortOrder: holiday.sortOrder,
      note: holiday.note,
    };
  }
}
