import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsCalendarDate } from '@/common/validators/is-calendar-date.validator';
import { TrainingResult } from '../entities/employee-training.entity';

/** Body của `PATCH /trainings/:id/participants/:employeeId` — ghi kết quả học. */
export class CompleteTrainingDto {
  @ApiProperty({ enum: TrainingResult })
  @IsEnum(TrainingResult)
  result: TrainingResult;

  @ApiPropertyOptional({
    example: '2026-06-12',
    description: 'Bỏ trống = ngày kết thúc khoá học.',
  })
  @IsOptional()
  @IsCalendarDate()
  completionDate?: string;

  @ApiPropertyOptional({ example: 8.5, minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;

  @ApiPropertyOptional({ example: 'https://.../chung-chi-nv0051.pdf' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  certificateUrl?: string;

  @ApiPropertyOptional({ example: 'Vắng buổi 2, đã học bù' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
