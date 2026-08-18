import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsBooleanValue } from '@/common/decorators/is-boolean-value.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { HolidayType } from '../entities/holiday.entity';

/** `holidays.year` is a SMALLINT – bounds the year range to what's reasonable for HRM. */
export const MIN_HOLIDAY_YEAR = 1900;
export const MAX_HOLIDAY_YEAR = 2200;

/** Whitelist of sortable columns – prevents interpolating `sort` directly into SQL. */
export const HOLIDAY_SORT_KEYS = ['holidayDate', 'name', 'year'] as const;

export type HolidaySortKey = (typeof HOLIDAY_SORT_KEYS)[number];

export class FilterHolidayDto extends PaginationDto {
  @ApiPropertyOptional({ enum: HOLIDAY_SORT_KEYS, default: 'holidayDate' })
  @IsOptional()
  @IsIn(HOLIDAY_SORT_KEYS)
  sort?: HolidaySortKey = 'holidayDate';

  @ApiPropertyOptional({ example: 2026, description: 'Lọc theo năm' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_HOLIDAY_YEAR)
  @Max(MAX_HOLIDAY_YEAR)
  year?: number;

  @ApiPropertyOptional({ enum: HolidayType })
  @IsOptional()
  @IsEnum(HolidayType)
  type?: HolidayType;

  @ApiPropertyOptional({ description: 'Lọc ngày lễ có/không hưởng lương' })
  @IsOptional()
  @IsBooleanValue()
  isPaid?: boolean;
}
