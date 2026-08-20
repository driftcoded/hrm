import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  REVIEW_ACKNOWLEDGE_ROLES,
  REVIEW_WRITE_ROLES,
} from '@/common/constants/roles.constant';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { toIsoString } from '@/common/utils/date.util';
import { resolvePagination } from '@/common/utils/pagination.util';
import {
  periodFieldsError,
  summariseReview,
} from '@/common/utils/performance-review.util';
import { EmployeesService } from '@/modules/employees/employees.service';
import { CreatePerformanceReviewDto } from './dto/create-performance-review.dto';
import { FilterPerformanceReviewDto } from './dto/filter-performance-review.dto';
import { PerformanceReviewResponseDto } from './dto/performance-review-response.dto';
import { UpdatePerformanceReviewDto } from './dto/update-performance-review.dto';
import {
  PerformanceReview,
  ReviewStatus,
} from './entities/performance-review.entity';
import { PerformanceReviewsRepository } from './performance-reviews.repository';

/**
 * Đánh giá hiệu suất (PLAN 7.1). Người chấm viết; nhân viên không tự chấm.
 *
 * Vòng đời: `draft` (còn sửa) → `submitted` (đã chốt) → `acknowledged` (nhân sự
 * ghi nhận nhân viên đã ký nhận bản giấy).
 *
 * Điểm tổng và xếp loại do `summariseReview` tính, không nhận từ client.
 */
@Injectable()
export class PerformanceReviewsService {
  private readonly logger = new Logger(PerformanceReviewsService.name);

  constructor(
    private readonly repository: PerformanceReviewsRepository,
    private readonly employeesService: EmployeesService,
  ) {}

  async findAll(
    filter: FilterPerformanceReviewDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<PerformanceReviewResponseDto>> {
    const scope = await this.employeesService.resolveScope(user);

    if (scope.kind === 'self') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Role "${user.role}" cannot read performance reviews`,
      });
    }

    const { page, limit, skip } = resolvePagination(filter);

    const [reviews, total] = await this.repository.findPaginated({
      ...filter,
      skip,
      take: limit,
      departmentScope:
        scope.kind === 'department' ? scope.departmentIds : undefined,
    });

    return new PaginatedResponseDto(
      reviews.map((review) => this.toResponse(review)),
      total,
      page,
      limit,
    );
  }

  async findOne(
    id: number,
    user: AuthenticatedUser,
  ): Promise<PerformanceReviewResponseDto> {
    const review = await this.getExistingOrThrow(id);

    // Phạm vi xem đánh giá bám theo phạm vi xem hồ sơ nhân viên.
    await this.employeesService.findOne(Number(review.employeeId), user);

    return this.toResponse(review);
  }

  async create(
    dto: CreatePerformanceReviewDto,
    user: AuthenticatedUser,
  ): Promise<PerformanceReviewResponseDto> {
    const reviewerId = await this.assertCanReview(dto.employeeId, user);

    this.assertPeriodShape(dto);

    const existing = await this.repository.findByPeriod(
      dto.employeeId,
      dto.reviewPeriod,
      dto.periodYear,
      dto.periodQuarter ?? null,
      dto.periodMonth ?? null,
    );

    if (existing) {
      throw new ConflictException({
        code: 'REVIEW_PERIOD_TAKEN',
        message: `Employee ${dto.employeeId} already has a ${dto.reviewPeriod} review for that period (id ${existing.id})`,
      });
    }

    const outcome = summariseReview({
      kpiScore: dto.kpiScore ?? null,
      attitudeScore: dto.attitudeScore ?? null,
      skillScore: dto.skillScore ?? null,
    });

    const created = await this.repository.create({
      employeeId: dto.employeeId,
      reviewerId,
      reviewPeriod: dto.reviewPeriod,
      periodYear: dto.periodYear,
      periodQuarter: dto.periodQuarter ?? null,
      periodMonth: dto.periodMonth ?? null,
      kpiScore: this.toDecimal(dto.kpiScore),
      attitudeScore: this.toDecimal(dto.attitudeScore),
      skillScore: this.toDecimal(dto.skillScore),
      overallScore: this.toDecimal(outcome.overallScore ?? undefined),
      rating: outcome.rating,
      strengths: dto.strengths?.trim() || null,
      weaknesses: dto.weaknesses?.trim() || null,
      recommendations: dto.recommendations?.trim() || null,
      status: ReviewStatus.DRAFT,
      note: dto.note?.trim() || null,
    });

    return this.toResponse(await this.getExistingOrThrow(Number(created.id)));
  }

  /** Sửa bản nháp và tính lại điểm tổng. Chỉ khi còn `draft`. */
  async update(
    id: number,
    dto: UpdatePerformanceReviewDto,
    user: AuthenticatedUser,
  ): Promise<PerformanceReviewResponseDto> {
    const review = await this.getExistingOrThrow(id);

    await this.assertCanReview(Number(review.employeeId), user);
    this.assertDraft(review);

    const next = {
      reviewPeriod: dto.reviewPeriod ?? review.reviewPeriod,
      periodYear: dto.periodYear ?? review.periodYear,
      periodQuarter:
        dto.periodQuarter === undefined
          ? review.periodQuarter
          : dto.periodQuarter,
      periodMonth:
        dto.periodMonth === undefined ? review.periodMonth : dto.periodMonth,
    };

    this.assertPeriodShape(next);

    review.reviewPeriod = next.reviewPeriod;
    review.periodYear = next.periodYear;
    review.periodQuarter = next.periodQuarter;
    review.periodMonth = next.periodMonth;

    if (dto.kpiScore !== undefined) {
      review.kpiScore = this.toDecimal(dto.kpiScore);
    }
    if (dto.attitudeScore !== undefined) {
      review.attitudeScore = this.toDecimal(dto.attitudeScore);
    }
    if (dto.skillScore !== undefined) {
      review.skillScore = this.toDecimal(dto.skillScore);
    }
    if (dto.strengths !== undefined) {
      review.strengths = dto.strengths.trim() || null;
    }
    if (dto.weaknesses !== undefined) {
      review.weaknesses = dto.weaknesses.trim() || null;
    }
    if (dto.recommendations !== undefined) {
      review.recommendations = dto.recommendations.trim() || null;
    }
    if (dto.note !== undefined) {
      review.note = dto.note.trim() || null;
    }

    // Tính lại từ các điểm sau khi ghép, để điểm tổng khớp với ba tiêu chí.
    const outcome = summariseReview({
      kpiScore: review.kpiScore === null ? null : Number(review.kpiScore),
      attitudeScore:
        review.attitudeScore === null ? null : Number(review.attitudeScore),
      skillScore: review.skillScore === null ? null : Number(review.skillScore),
    });

    review.overallScore = this.toDecimal(outcome.overallScore ?? undefined);
    review.rating = outcome.rating;

    await this.repository.save(review);

    return this.toResponse(await this.getExistingOrThrow(id));
  }

  /** Chốt bản đánh giá. Từ đây không sửa được nữa. */
  async submit(
    id: number,
    user: AuthenticatedUser,
  ): Promise<PerformanceReviewResponseDto> {
    const review = await this.getExistingOrThrow(id);

    await this.assertCanReview(Number(review.employeeId), user);
    this.assertDraft(review);

    // Không chốt bản chưa chấm điểm nào — `submitted` là khoá vĩnh viễn.
    if (review.overallScore === null) {
      throw new UnprocessableEntityException({
        code: 'REVIEW_HAS_NO_SCORE',
        message: `Review ${id} has no score on any criterion; there is nothing to submit`,
      });
    }

    review.status = ReviewStatus.SUBMITTED;
    await this.repository.save(review);

    this.logger.log(
      `Performance review ${id} submitted by user ${user.userId}`,
    );

    return this.toResponse(await this.getExistingOrThrow(id));
  }

  /** Ghi nhận nhân viên đã ký nhận bản đánh giá. Thao tác của nhân sự. */
  async acknowledge(
    id: number,
    user: AuthenticatedUser,
  ): Promise<PerformanceReviewResponseDto> {
    if (!REVIEW_ACKNOWLEDGE_ROLES.includes(user.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Role "${user.role}" cannot record an acknowledgement; requires one of roles: ${REVIEW_ACKNOWLEDGE_ROLES.join(', ')}`,
      });
    }

    const review = await this.getExistingOrThrow(id);

    if (review.status !== ReviewStatus.SUBMITTED) {
      throw new ConflictException({
        code: 'REVIEW_NOT_SUBMITTED',
        message: `Review ${id} is "${review.status}"; only a submitted review can be acknowledged`,
      });
    }

    review.status = ReviewStatus.ACKNOWLEDGED;
    review.acknowledgedAt = new Date();

    await this.repository.save(review);

    return this.toResponse(await this.getExistingOrThrow(id));
  }

  /** Xoá bản nháp. Bản đã chốt thì không xoá được. */
  async remove(
    id: number,
    user: AuthenticatedUser,
  ): Promise<{ id: number; deleted: boolean }> {
    const review = await this.getExistingOrThrow(id);

    await this.assertCanReview(Number(review.employeeId), user);
    this.assertDraft(review);

    await this.repository.remove(id);

    return { id, deleted: true };
  }

  // --------------------------------------------------------- nội bộ ----

  /**
   * Kiểm vai trò và phạm vi hồ sơ của người chấm.
   *
   * Trả về `employees.id` của họ để ghi vào `reviewer_id`.
   */
  private async assertCanReview(
    employeeId: number,
    user: AuthenticatedUser,
  ): Promise<number> {
    if (!REVIEW_WRITE_ROLES.includes(user.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Role "${user.role}" cannot write performance reviews; requires one of roles: ${REVIEW_WRITE_ROLES.join(', ')}`,
      });
    }

    await this.employeesService.findOne(employeeId, user);

    // `reviewer_id` NOT NULL: tài khoản không gắn hồ sơ nhân viên thì không chấm được.
    if (user.employeeId === null || user.employeeId === undefined) {
      throw new UnprocessableEntityException({
        code: 'REVIEWER_HAS_NO_EMPLOYEE_RECORD',
        message: `User ${user.userId} is not linked to an employee record and cannot sign a review`,
      });
    }

    return Number(user.employeeId);
  }

  private assertPeriodShape(input: {
    reviewPeriod: string;
    periodQuarter?: number | null;
    periodMonth?: number | null;
  }): void {
    const error = periodFieldsError(
      input.reviewPeriod as 'monthly' | 'quarterly' | 'biannual' | 'annual',
      input.periodQuarter ?? null,
      input.periodMonth ?? null,
    );

    if (error) {
      throw new UnprocessableEntityException({
        code: 'REVIEW_PERIOD_MISMATCH',
        message: error,
      });
    }
  }

  private assertDraft(review: PerformanceReview): void {
    if (review.status !== ReviewStatus.DRAFT) {
      throw new ConflictException({
        code: 'REVIEW_NOT_DRAFT',
        message: `Review ${review.id} is "${review.status}" and can no longer be changed`,
      });
    }
  }

  private toDecimal(value: number | undefined): string | null {
    return value === undefined ? null : value.toFixed(2);
  }

  private async getExistingOrThrow(id: number): Promise<PerformanceReview> {
    const review = await this.repository.findById(id);

    if (!review) {
      throw new NotFoundException({
        code: 'REVIEW_NOT_FOUND',
        message: `Performance review ${id} not found`,
      });
    }

    return review;
  }

  private toResponse(review: PerformanceReview): PerformanceReviewResponseDto {
    const toNumber = (value: string | null): number | null =>
      value === null ? null : Number(value);

    return {
      id: Number(review.id),
      employeeId: Number(review.employeeId),
      employee: {
        id: Number(review.employee?.id ?? review.employeeId),
        employeeCode: review.employee?.employeeCode ?? '',
        fullName: review.employee?.fullName ?? '',
        departmentName: review.employee?.department?.name ?? null,
      },
      reviewerId: Number(review.reviewerId),
      reviewerName: review.reviewer?.fullName ?? null,
      reviewPeriod: review.reviewPeriod,
      periodYear: review.periodYear,
      periodQuarter: review.periodQuarter,
      periodMonth: review.periodMonth,
      kpiScore: toNumber(review.kpiScore),
      attitudeScore: toNumber(review.attitudeScore),
      skillScore: toNumber(review.skillScore),
      overallScore: toNumber(review.overallScore),
      rating: review.rating,
      strengths: review.strengths,
      weaknesses: review.weaknesses,
      recommendations: review.recommendations,
      status: review.status,
      acknowledgedAt: review.acknowledgedAt
        ? toIsoString(review.acknowledgedAt)
        : null,
      note: review.note,
      createdAt: toIsoString(review.createdAt),
    };
  }
}
