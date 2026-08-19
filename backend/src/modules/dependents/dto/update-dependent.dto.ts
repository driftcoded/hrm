import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateDependentDto } from './create-dependent.dto';
import { DependentStatus } from '../entities/dependent.entity';

/**
 * `PATCH /employees/:id/dependents/:depId` — partial update.
 *
 * Hai field chỉ có ở đây (không có lúc tạo): ngừng tính giảm trừ là một sự kiện
 * xảy ra SAU khi đăng ký. Service bắt buộc `reasonInactive` khi chuyển sang
 * `inactive` — "vì sao thôi giảm trừ" là thứ cơ quan thuế sẽ hỏi.
 */
export class UpdateDependentDto extends PartialType(CreateDependentDto) {
  @ApiPropertyOptional({
    enum: DependentStatus,
    description: 'Chuyển sang `inactive` bắt buộc kèm `reasonInactive`',
  })
  @IsOptional()
  @IsEnum(DependentStatus)
  status?: DependentStatus;

  @ApiPropertyOptional({
    example: 'Người phụ thuộc đã có thu nhập',
    nullable: true,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reasonInactive?: string | null;
}
