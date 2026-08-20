import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsCalendarDate } from '@/common/validators/is-calendar-date.validator';
import { TrainingType } from '../entities/training.entity';

/** Body của `POST /trainings`. Không nhận `status` — khoá mới luôn là `planned`. */
export class CreateTrainingDto {
  @ApiProperty({ example: 'TRN-2026-001', maxLength: 30 })
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  code: string;

  @ApiProperty({ example: 'Kỹ năng lãnh đạo', maxLength: 200 })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @ApiProperty({ enum: TrainingType })
  @IsEnum(TrainingType)
  type: TrainingType;

  @ApiPropertyOptional({ example: 'Khoá 3 ngày cho cấp quản lý' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: '2026-06-10' })
  @IsOptional()
  @IsCalendarDate()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-06-12' })
  @IsOptional()
  @IsCalendarDate()
  endDate?: string;

  @ApiPropertyOptional({ example: 'Hà Nội', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ example: 'Học viện Kỹ năng PACE', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  trainer?: string;

  @ApiPropertyOptional({ example: 5000000, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiPropertyOptional({
    example: 20,
    minimum: 1,
    description: 'Bỏ trống = không giới hạn số người.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxParticipants?: number;

  @ApiPropertyOptional({ example: 'https://.../ke-hoach-dao-tao.pdf' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  attachmentUrl?: string;

  @ApiPropertyOptional({ example: 'Ngân sách đã duyệt theo QĐ-2026-018' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
