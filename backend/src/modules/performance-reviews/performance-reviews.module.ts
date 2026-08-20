import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeesModule } from '@/modules/employees/employees.module';
import { PerformanceReview } from './entities/performance-review.entity';
import { PerformanceReviewsController } from './performance-reviews.controller';
import { PerformanceReviewsRepository } from './performance-reviews.repository';
import { PerformanceReviewsService } from './performance-reviews.service';

/** Đánh giá hiệu suất (PLAN 7.1). `EmployeesModule` cung cấp `resolveScope`. */
@Module({
  imports: [TypeOrmModule.forFeature([PerformanceReview]), EmployeesModule],
  controllers: [PerformanceReviewsController],
  providers: [PerformanceReviewsRepository, PerformanceReviewsService],
  exports: [PerformanceReviewsService],
})
export class PerformanceReviewsModule {}
