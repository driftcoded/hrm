import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_HOLIDAY_YEAR, MIN_HOLIDAY_YEAR } from './filter-holiday.dto';

/** Query params for `GET /system/holidays` (api-spec.md §20). */
export class SystemHolidayQueryDto {
  @ApiPropertyOptional({
    example: 2026,
    description: 'Mặc định = năm hiện tại',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_HOLIDAY_YEAR)
  @Max(MAX_HOLIDAY_YEAR)
  year?: number;
}
