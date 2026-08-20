import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  MAX_ATTENDANCE_YEAR,
  MIN_ATTENDANCE_YEAR,
} from './filter-attendance.dto';

/**
 * Query của `GET /attendances/stats`.
 *
 * Không có phân trang và không có `status` — kết quả chính là phân tích theo
 * trạng thái, nên màn hình biểu đồ bỏ qua ô lọc trạng thái khi gọi endpoint này.
 */
export class FilterAttendanceStatsDto {
  @ApiPropertyOptional({ example: 51 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId?: number;

  @ApiPropertyOptional({
    description: 'Tháng (1–12). Phải đi KÈM `year`.',
    example: 5,
    minimum: 1,
    maximum: 12,
  })
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
