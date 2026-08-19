import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { IsCalendarDate } from '@/common/validators/is-calendar-date.validator';
import { LeaveRequestStatus } from '@/modules/leaves/entities/leave-request.entity';

export const LEAVE_REQUEST_SORT_KEYS = [
  'startDate',
  'createdAt',
  'totalDays',
] as const;

export type LeaveRequestSortKey = (typeof LEAVE_REQUEST_SORT_KEYS)[number];

/** Query của `GET /leave-requests`. */
export class FilterLeaveRequestDto extends PaginationDto {
  @ApiPropertyOptional({ enum: LEAVE_REQUEST_SORT_KEYS, default: 'startDate' })
  @IsOptional()
  @IsIn(LEAVE_REQUEST_SORT_KEYS)
  sort?: LeaveRequestSortKey = 'startDate';

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

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  leaveTypeId?: number;

  @ApiPropertyOptional({
    enum: LeaveRequestStatus,
    description: 'Trang duyệt dùng `?status=pending`.',
  })
  @IsOptional()
  @IsEnum(LeaveRequestStatus)
  status?: LeaveRequestStatus;

  @ApiPropertyOptional({
    example: '2026-05-01',
    description:
      'Lọc theo kỳ nghỉ GIAO NHAU với khoảng [from, to] — không phải chỉ đơn bắt đầu trong khoảng. Một kỳ nghỉ bắc qua đầu tháng vẫn phải hiện trong tháng đó.',
  })
  @IsOptional()
  @IsCalendarDate()
  from?: string;

  @ApiPropertyOptional({ example: '2026-05-31' })
  @IsOptional()
  @IsCalendarDate()
  to?: string;
}
