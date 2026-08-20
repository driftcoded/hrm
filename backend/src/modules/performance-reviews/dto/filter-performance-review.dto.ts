import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import {
  ReviewPeriod,
  ReviewRating,
  ReviewStatus,
} from '../entities/performance-review.entity';

/** Query của `GET /performance-reviews`. */
export class FilterPerformanceReviewDto extends PaginationDto {
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

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  periodYear?: number;

  @ApiPropertyOptional({ enum: ReviewPeriod })
  @IsOptional()
  @IsEnum(ReviewPeriod)
  reviewPeriod?: ReviewPeriod;

  @ApiPropertyOptional({ enum: ReviewStatus })
  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;

  @ApiPropertyOptional({ enum: ReviewRating })
  @IsOptional()
  @IsEnum(ReviewRating)
  rating?: ReviewRating;
}
