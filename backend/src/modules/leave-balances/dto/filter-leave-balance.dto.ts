import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export const LEAVE_BALANCE_SORT_KEYS = ['year', 'remainingDays'] as const;

export type LeaveBalanceSortKey = (typeof LEAVE_BALANCE_SORT_KEYS)[number];

export const MIN_LEAVE_YEAR = 2000;
export const MAX_LEAVE_YEAR = 2100;

/** Query của `GET /leave-balances`. */
export class FilterLeaveBalanceDto extends PaginationDto {
  @ApiPropertyOptional({ enum: LEAVE_BALANCE_SORT_KEYS, default: 'year' })
  @IsOptional()
  @IsIn(LEAVE_BALANCE_SORT_KEYS)
  sort?: LeaveBalanceSortKey = 'year';

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

  @ApiPropertyOptional({ example: 1, description: 'Loại nghỉ phép' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  leaveTypeId?: number;

  @ApiPropertyOptional({
    example: 2026,
    description:
      'Bỏ trống thì lấy năm hiện tại — quỹ phép luôn thuộc về một năm cụ thể.',
    minimum: MIN_LEAVE_YEAR,
    maximum: MAX_LEAVE_YEAR,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_LEAVE_YEAR)
  @Max(MAX_LEAVE_YEAR)
  year?: number;
}
