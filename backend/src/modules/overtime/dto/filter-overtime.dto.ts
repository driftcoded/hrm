import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import {
  MAX_ATTENDANCE_YEAR,
  MIN_ATTENDANCE_YEAR,
} from '@/modules/attendances/dto/filter-attendance.dto';
import { OvertimeRequestStatus } from '../entities/overtime-request.entity';

export const OVERTIME_SORT_KEYS = [
  'workDate',
  'createdAt',
  'totalHours',
] as const;

export type OvertimeSortKey = (typeof OVERTIME_SORT_KEYS)[number];

/** Query của `GET /overtime-requests`. */
export class FilterOvertimeDto extends PaginationDto {
  @ApiPropertyOptional({ enum: OVERTIME_SORT_KEYS, default: 'workDate' })
  @IsOptional()
  @IsIn(OVERTIME_SORT_KEYS)
  sort?: OvertimeSortKey = 'workDate';

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
    enum: OvertimeRequestStatus,
    description: 'Trang duyệt của quản lý dùng `?status=pending`.',
  })
  @IsOptional()
  @IsEnum(OvertimeRequestStatus)
  status?: OvertimeRequestStatus;

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
