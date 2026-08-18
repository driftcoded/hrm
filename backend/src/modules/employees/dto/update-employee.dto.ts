import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { IsCalendarDate } from '@/common/validators/is-calendar-date.validator';
import { TerminationType } from '../entities/employee.entity';
import { CreateEmployeeDto } from './create-employee.dto';

/**
 * `PATCH /employees/:id` (api-spec.md §3) — partial update.
 *
 * Field vắng mặt = không đổi; gửi `null` cho field nullable = xoá giá trị.
 * Ba field nghỉ việc chỉ có ở đây (không có lúc tạo hồ sơ): một nhân viên
 * không thể vừa được tuyển vừa đã nghỉ.
 */
export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
  @ApiPropertyOptional({ example: '2026-10-31', nullable: true })
  @IsOptional()
  @IsCalendarDate()
  terminationDate?: string | null;

  @ApiPropertyOptional({ example: 'Nhân viên xin thôi việc', nullable: true })
  @IsOptional()
  @IsString()
  terminationReason?: string | null;

  @ApiPropertyOptional({ enum: TerminationType, nullable: true })
  @IsOptional()
  @IsEnum(TerminationType)
  terminationType?: TerminationType | null;
}
