import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ReviewPeriod,
  ReviewRating,
  ReviewStatus,
} from '../entities/performance-review.entity';

export class ReviewPersonDto {
  @ApiProperty({ example: 51 })
  id: number;

  @ApiProperty({ example: 'NV0051' })
  employeeCode: string;

  @ApiProperty({ example: 'Nguyễn Văn Bình' })
  fullName: string;

  @ApiPropertyOptional({ example: 'Phòng Kỹ thuật' })
  departmentName: string | null;
}

export class PerformanceReviewResponseDto {
  @ApiProperty({ example: 7 })
  id: number;

  @ApiProperty({ example: 51 })
  employeeId: number;

  @ApiProperty({ type: ReviewPersonDto })
  employee: ReviewPersonDto;

  @ApiProperty({ example: 12 })
  reviewerId: number;

  @ApiPropertyOptional({ example: 'Lê Văn Trưởng Nhóm' })
  reviewerName: string | null;

  @ApiProperty({ enum: ReviewPeriod })
  reviewPeriod: ReviewPeriod;

  @ApiProperty({ example: 2026 })
  periodYear: number;

  @ApiPropertyOptional({ example: 2 })
  periodQuarter: number | null;

  @ApiPropertyOptional({ example: null })
  periodMonth: number | null;

  @ApiPropertyOptional({ example: 85.5 })
  kpiScore: number | null;

  @ApiPropertyOptional({ example: 90 })
  attitudeScore: number | null;

  @ApiPropertyOptional({ example: 88 })
  skillScore: number | null;

  @ApiPropertyOptional({
    example: 87.83,
    description:
      'Trung bình các tiêu chí ĐÃ chấm — server tính, không nhận từ client.',
  })
  overallScore: number | null;

  @ApiPropertyOptional({ enum: ReviewRating })
  rating: ReviewRating | null;

  @ApiPropertyOptional({ example: 'Chủ động, hoàn thành đúng deadline' })
  strengths: string | null;

  @ApiPropertyOptional({ example: 'Cần cải thiện kỹ năng trình bày' })
  weaknesses: string | null;

  @ApiPropertyOptional({
    example: 'Đề xuất tham gia khoá đào tạo presentation',
  })
  recommendations: string | null;

  @ApiProperty({ enum: ReviewStatus })
  status: ReviewStatus;

  @ApiPropertyOptional({
    example: '2026-07-05T02:00:00.000Z',
    description:
      'Thời điểm nhân sự ghi nhận nhân viên đã ký nhận bản đánh giá.',
  })
  acknowledgedAt: string | null;

  @ApiPropertyOptional({ example: 'Đã trao đổi trực tiếp ngày 30/06' })
  note: string | null;

  @ApiProperty({ example: '2026-07-01T02:00:00.000Z' })
  createdAt: string;
}
