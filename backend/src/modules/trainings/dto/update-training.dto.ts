import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { TrainingStatus } from '../entities/training.entity';
import { CreateTrainingDto } from './create-training.dto';

/**
 * Body của `PATCH /trainings/:id`.
 *
 * `status` mở ở đây vì vòng đời khoá học đi bằng chính ô này; service chặn các
 * bước chuyển không hợp lệ.
 */
export class UpdateTrainingDto extends PartialType(CreateTrainingDto) {
  @ApiPropertyOptional({ enum: TrainingStatus })
  @IsOptional()
  @IsEnum(TrainingStatus)
  status?: TrainingStatus;
}
