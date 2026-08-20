import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { FIRST_SUPPORTED_PAYROLL_YEAR } from '@/common/constants/payroll.constant';
import {
  MAX_REVIEW_SCORE,
  MIN_REVIEW_SCORE,
} from '@/common/utils/performance-review.util';
import { ReviewPeriod } from '../entities/performance-review.entity';

/**
 * Body của `POST /performance-reviews`.
 *
 * Người chấm lấy từ token; `overallScore` và `rating` do server tính.
 */
export class CreatePerformanceReviewDto {
  @ApiProperty({ example: 51, description: 'Nhân viên được đánh giá.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId: number;

  @ApiProperty({ enum: ReviewPeriod })
  @IsEnum(ReviewPeriod)
  reviewPeriod: ReviewPeriod;

  @ApiProperty({ example: 2026, minimum: FIRST_SUPPORTED_PAYROLL_YEAR })
  @Type(() => Number)
  @IsInt()
  @Min(FIRST_SUPPORTED_PAYROLL_YEAR)
  periodYear: number;

  @ApiPropertyOptional({
    example: 2,
    minimum: 1,
    maximum: 4,
    description:
      'Bắt buộc với kỳ `quarterly` (1–4) và `biannual` (1 = nửa đầu, 2 = nửa sau). Kỳ khác thì không được gửi.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  periodQuarter?: number;

  @ApiPropertyOptional({
    example: 5,
    minimum: 1,
    maximum: 12,
    description: 'Bắt buộc với kỳ `monthly`. Kỳ khác thì không được gửi.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth?: number;

  @ApiPropertyOptional({ example: 85.5, minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(MIN_REVIEW_SCORE)
  @Max(MAX_REVIEW_SCORE)
  kpiScore?: number;

  @ApiPropertyOptional({ example: 90, minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(MIN_REVIEW_SCORE)
  @Max(MAX_REVIEW_SCORE)
  attitudeScore?: number;

  @ApiPropertyOptional({ example: 88, minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(MIN_REVIEW_SCORE)
  @Max(MAX_REVIEW_SCORE)
  skillScore?: number;

  @ApiPropertyOptional({ example: 'Chủ động, hoàn thành đúng deadline' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  strengths?: string;

  @ApiPropertyOptional({ example: 'Cần cải thiện kỹ năng trình bày' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  weaknesses?: string;

  @ApiPropertyOptional({
    example: 'Đề xuất tham gia khoá đào tạo presentation',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  recommendations?: string;

  @ApiPropertyOptional({ example: 'Đã trao đổi trực tiếp ngày 30/06' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
