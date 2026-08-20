import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FilterPerformanceReviewDto } from './dto/filter-performance-review.dto';
import { PerformanceReview } from './entities/performance-review.entity';

export interface FindReviewsOptions extends FilterPerformanceReviewDto {
  skip: number;
  take: number;
  /** `undefined` = không giới hạn; mảng rỗng = không quản phòng nào. */
  departmentScope?: number[];
}

/** Chỉ chứa TypeORM query (CLAUDE.md §Kiến trúc module). */
@Injectable()
export class PerformanceReviewsRepository {
  constructor(
    @InjectRepository(PerformanceReview)
    private readonly repository: Repository<PerformanceReview>,
  ) {}

  findPaginated(
    options: FindReviewsOptions,
  ): Promise<[PerformanceReview[], number]> {
    const query = this.repository
      .createQueryBuilder('review')
      .innerJoinAndSelect('review.employee', 'employee')
      .leftJoinAndSelect('employee.department', 'department')
      .leftJoinAndSelect('review.reviewer', 'reviewer')
      // Kỳ mới nhất trước: năm, rồi quý, rồi tháng — không sắp theo `created_at`.
      .orderBy('review.periodYear', 'DESC')
      .addOrderBy('review.periodQuarter', 'DESC')
      .addOrderBy('review.periodMonth', 'DESC')
      .addOrderBy('review.id', 'DESC')
      .skip(options.skip)
      .take(options.take);

    if (options.employeeId !== undefined) {
      query.andWhere('review.employeeId = :employeeId', {
        employeeId: options.employeeId,
      });
    }

    if (options.departmentId !== undefined) {
      query.andWhere('employee.departmentId = :departmentId', {
        departmentId: options.departmentId,
      });
    }

    if (options.periodYear !== undefined) {
      query.andWhere('review.periodYear = :periodYear', {
        periodYear: options.periodYear,
      });
    }

    if (options.reviewPeriod !== undefined) {
      query.andWhere('review.reviewPeriod = :reviewPeriod', {
        reviewPeriod: options.reviewPeriod,
      });
    }

    if (options.status !== undefined) {
      query.andWhere('review.status = :status', { status: options.status });
    }

    if (options.rating !== undefined) {
      query.andWhere('review.rating = :rating', { rating: options.rating });
    }

    if (options.departmentScope) {
      // Mảng rỗng = không quản phòng nào → không thấy dòng nào.
      if (options.departmentScope.length === 0) {
        query.andWhere('1 = 0');
      } else {
        query.andWhere('employee.departmentId IN (:...departmentScope)', {
          departmentScope: options.departmentScope,
        });
      }
    }

    return query.getManyAndCount();
  }

  findById(id: number): Promise<PerformanceReview | null> {
    return this.repository.findOne({
      where: { id },
      relations: { employee: { department: true }, reviewer: true },
    });
  }

  /** Bản đánh giá đã có của một nhân viên trong đúng kỳ, dùng để chặn trùng. */
  findByPeriod(
    employeeId: number,
    reviewPeriod: string,
    periodYear: number,
    periodQuarter: number | null,
    periodMonth: number | null,
  ): Promise<PerformanceReview | null> {
    const query = this.repository
      .createQueryBuilder('review')
      .where('review.employeeId = :employeeId', { employeeId })
      .andWhere('review.reviewPeriod = :reviewPeriod', { reviewPeriod })
      .andWhere('review.periodYear = :periodYear', { periodYear });

    query.andWhere(
      periodQuarter === null
        ? 'review.periodQuarter IS NULL'
        : 'review.periodQuarter = :periodQuarter',
      periodQuarter === null ? {} : { periodQuarter },
    );

    query.andWhere(
      periodMonth === null
        ? 'review.periodMonth IS NULL'
        : 'review.periodMonth = :periodMonth',
      periodMonth === null ? {} : { periodMonth },
    );

    return query.getOne();
  }

  create(data: Partial<PerformanceReview>): Promise<PerformanceReview> {
    return this.repository.save(this.repository.create(data));
  }

  save(review: PerformanceReview): Promise<PerformanceReview> {
    return this.repository.save(review);
  }

  remove(id: number): Promise<unknown> {
    return this.repository.delete(id);
  }
}
