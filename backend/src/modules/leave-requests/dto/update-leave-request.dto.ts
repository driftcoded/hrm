import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsCalendarDate } from '@/common/validators/is-calendar-date.validator';
import { LeaveHalf } from '@/modules/leaves/entities/leave-request.entity';

/**
 * Body của `PATCH /leave-requests/:id` — sửa một đơn CÒN CHỜ DUYỆT.
 *
 * KHÔNG có `employeeId`. Đổi người được nghỉ không phải là sửa đơn mà là một đơn
 * khác: quỹ phép, phạm vi quản lý của người ghi và cả việc kiểm tra trùng ngày
 * đều tính theo nhân viên. Nhập nhầm người thì xoá đơn rồi ghi lại.
 *
 * Vẫn KHÔNG nhận `totalDays` — server tính lại từ khoảng ngày mới, giống hệt
 * lúc ghi nhận.
 */
export class UpdateLeaveRequestDto {
  @ApiPropertyOptional({ example: 1, description: 'Loại nghỉ phép.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  leaveTypeId?: number;

  @ApiPropertyOptional({ example: '2026-05-04', description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsCalendarDate()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-05-08', description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsCalendarDate()
  endDate?: string;

  @ApiPropertyOptional({
    enum: LeaveHalf,
    description:
      'Nghỉ nửa ngày đầu kỳ: `morning` hoặc `afternoon` ⇒ trừ 0,5 ngày.',
  })
  @IsOptional()
  @IsEnum(LeaveHalf)
  startHalf?: LeaveHalf;

  @ApiPropertyOptional({ enum: LeaveHalf })
  @IsOptional()
  @IsEnum(LeaveHalf)
  endHalf?: LeaveHalf;

  @ApiPropertyOptional({
    example: 'Nghỉ phép năm về quê',
    minLength: 5,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason?: string;
}
