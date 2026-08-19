import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
 * Body của `POST /leave-requests` — quản lý/nhân sự GHI NHẬN đơn nghỉ phép cho
 * một nhân viên.
 *
 * `employeeId` là BẮT BUỘC và là người ĐƯỢC nghỉ, không phải người gửi request:
 * nhân viên không đăng nhập hệ thống này. Người ghi lấy từ token vào
 * `recorded_by`, không lấy từ body — để không ai ghi hộ dưới tên người khác.
 *
 * KHÔNG nhận `totalDays`: số ngày phép bị trừ do server tính từ khoảng ngày,
 * nửa ngày ở hai đầu, và lịch nghỉ lễ. Cho client gửi lên là cho khai 1 ngày
 * cho một kỳ nghỉ hai tuần.
 */
export class CreateLeaveRequestDto {
  @ApiProperty({ example: 51, description: 'Nhân viên được nghỉ.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId: number;

  @ApiProperty({ example: 1, description: 'Loại nghỉ phép.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  leaveTypeId: number;

  @ApiProperty({ example: '2026-05-04', description: 'YYYY-MM-DD' })
  @IsCalendarDate()
  startDate: string;

  @ApiProperty({ example: '2026-05-08', description: 'YYYY-MM-DD' })
  @IsCalendarDate()
  endDate: string;

  @ApiPropertyOptional({
    enum: LeaveHalf,
    default: LeaveHalf.FULL,
    description:
      'Nghỉ nửa ngày đầu kỳ: `morning` hoặc `afternoon` ⇒ trừ 0,5 ngày.',
  })
  @IsOptional()
  @IsEnum(LeaveHalf)
  startHalf?: LeaveHalf;

  @ApiPropertyOptional({ enum: LeaveHalf, default: LeaveHalf.FULL })
  @IsOptional()
  @IsEnum(LeaveHalf)
  endHalf?: LeaveHalf;

  @ApiProperty({
    example: 'Nghỉ phép năm về quê',
    minLength: 5,
    maxLength: 500,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}
