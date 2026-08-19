import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  MAX_ATTENDANCE_YEAR,
  MIN_ATTENDANCE_YEAR,
} from '@/modules/attendances/dto/filter-attendance.dto';

/**
 * Query của `GET /reports/attendances/export` (api-spec.md §19).
 *
 * `month` và `year` là BẮT BUỘC, khác với `GET /attendances` nơi chúng tuỳ
 * chọn: bảng chấm công là một tài liệu CỦA MỘT THÁNG. Không có tháng thì file
 * xuất ra là toàn bộ lịch sử chấm công của công ty — vừa vô nghĩa với người
 * nhận, vừa là một cú quét cả bảng.
 */
export class ExportAttendancesDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({
    example: 2026,
    minimum: MIN_ATTENDANCE_YEAR,
    maximum: MAX_ATTENDANCE_YEAR,
  })
  @Type(() => Number)
  @IsInt()
  @Min(MIN_ATTENDANCE_YEAR)
  @Max(MAX_ATTENDANCE_YEAR)
  year: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId?: number;

  @ApiPropertyOptional({ example: 51 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;
}
