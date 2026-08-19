import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  MAX_ATTENDANCE_YEAR,
  MIN_ATTENDANCE_YEAR,
} from './filter-attendance.dto';

/**
 * Query của `GET /attendances/me` (api-spec.md §7): `?month=5&year=2026`.
 *
 * Cả hai đều tuỳ chọn và mặc định về tháng hiện tại — mở màn hình chấm công
 * của mình thì thứ muốn xem gần như luôn là tháng này.
 */
export class MonthQueryDto {
  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({
    example: 2026,
    minimum: MIN_ATTENDANCE_YEAR,
    maximum: MAX_ATTENDANCE_YEAR,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_ATTENDANCE_YEAR)
  @Max(MAX_ATTENDANCE_YEAR)
  year?: number;
}
