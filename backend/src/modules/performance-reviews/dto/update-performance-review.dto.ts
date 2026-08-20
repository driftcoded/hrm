import { OmitType, PartialType } from '@nestjs/swagger';
import { CreatePerformanceReviewDto } from './create-performance-review.dto';

/** Body của `PATCH /performance-reviews/:id`. Không đổi được `employeeId`. */
export class UpdatePerformanceReviewDto extends PartialType(
  OmitType(CreatePerformanceReviewDto, ['employeeId'] as const),
) {}
