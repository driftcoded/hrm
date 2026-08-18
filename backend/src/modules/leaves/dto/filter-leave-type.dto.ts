import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { IsBooleanValue } from '@/common/decorators/is-boolean-value.decorator';
import { LeaveApplicableGender } from '../entities/leave-type.entity';

/**
 * `GET /leave-types` returns an ARRAY (api-spec.md §8), not a paginated
 * response: the primary key is TINYINT so the table holds at most 255 rows,
 * and the UI always needs the full list to render a dropdown. That's why this
 * DTO does NOT extend PaginationDto.
 */
export class FilterLeaveTypeDto {
  @ApiPropertyOptional({ description: 'Chỉ lấy loại đang bật/tắt' })
  @IsOptional()
  @IsBooleanValue()
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: LeaveApplicableGender,
    description: 'Lọc theo giới tính áp dụng',
  })
  @IsOptional()
  @IsEnum(LeaveApplicableGender)
  applicableGender?: LeaveApplicableGender;
}
