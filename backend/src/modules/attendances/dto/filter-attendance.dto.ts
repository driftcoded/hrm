import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { AttendanceStatus } from '../entities/attendance.entity';

export const ATTENDANCE_SORT_KEYS = [
  'workDate',
  'checkIn',
  'workHours',
] as const;

export type AttendanceSortKey = (typeof ATTENDANCE_SORT_KEYS)[number];

/**
 * Năm nhỏ nhất/lớn nhất chấp nhận cho bộ lọc.
 *
 * Không phải để bảo vệ dữ liệu mà để chặn `?year=0` hay `?year=999999` biến
 * thành một khoảng ngày vô nghĩa rồi quét toàn bảng.
 */
export const MIN_ATTENDANCE_YEAR = 2000;
export const MAX_ATTENDANCE_YEAR = 2100;

/** Query của `GET /attendances` (api-spec.md §7). */
export class FilterAttendanceDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ATTENDANCE_SORT_KEYS, default: 'workDate' })
  @IsOptional()
  @IsIn(ATTENDANCE_SORT_KEYS)
  sort?: AttendanceSortKey = 'workDate';

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
    description:
      'Tháng (1–12). Phải đi KÈM `year` — một mình `month` thì không xác định được khoảng ngày.',
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

  @ApiPropertyOptional({ enum: AttendanceStatus })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;
}
