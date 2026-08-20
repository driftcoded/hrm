import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { TrainingStatus, TrainingType } from '../entities/training.entity';

/** Query của `GET /trainings`. `search` kế thừa từ `PaginationDto`, tìm theo mã hoặc tên. */
export class FilterTrainingDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TrainingStatus })
  @IsOptional()
  @IsEnum(TrainingStatus)
  status?: TrainingStatus;

  @ApiPropertyOptional({ enum: TrainingType })
  @IsOptional()
  @IsEnum(TrainingType)
  type?: TrainingType;
}
