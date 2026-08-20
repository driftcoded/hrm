import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { EmployeesService } from '@/modules/employees/employees.service';
import {
  PerformanceReview,
  ReviewPeriod,
  ReviewRating,
  ReviewStatus,
} from './entities/performance-review.entity';
import { PerformanceReviewsRepository } from './performance-reviews.repository';
import { PerformanceReviewsService } from './performance-reviews.service';

const EMPLOYEE_ID = 51;

/** Nhân sự — chấm được cho bất kỳ ai, và ghi nhận được việc ký nhận. */
const hrUser: AuthenticatedUser = {
  userId: 2,
  username: 'hr.manager',
  role: 'hr_manager',
  employeeId: 2,
  sessionId: 1,
};

/** Trưởng phòng — chấm được người phòng mình, KHÔNG ghi nhận ký nhận. */
const managerUser: AuthenticatedUser = {
  userId: 4,
  username: 'manager',
  role: 'manager',
  employeeId: 12,
  sessionId: 1,
};

/** Tài khoản admin seed sẵn — không gắn với hồ sơ nhân viên nào. */
const adminUser: AuthenticatedUser = {
  userId: 1,
  username: 'admin',
  role: 'admin',
  employeeId: null,
  sessionId: 1,
};

function makeReview(
  overrides: Partial<PerformanceReview> = {},
): PerformanceReview {
  return {
    id: 7,
    employeeId: EMPLOYEE_ID,
    reviewerId: 12,
    reviewPeriod: ReviewPeriod.QUARTERLY,
    periodYear: 2026,
    periodQuarter: 2,
    periodMonth: null,
    kpiScore: '85.50',
    attitudeScore: '90.00',
    skillScore: '88.00',
    overallScore: '87.83',
    rating: ReviewRating.GOOD,
    strengths: null,
    weaknesses: null,
    recommendations: null,
    status: ReviewStatus.DRAFT,
    acknowledgedAt: null,
    note: null,
    createdAt: new Date('2026-07-01T02:00:00.000Z'),
    updatedAt: new Date('2026-07-01T02:00:00.000Z'),
    employee: null,
    reviewer: null,
    ...overrides,
  } as unknown as PerformanceReview;
}

function makeDto(overrides: Record<string, unknown> = {}) {
  return {
    employeeId: EMPLOYEE_ID,
    reviewPeriod: ReviewPeriod.QUARTERLY,
    periodYear: 2026,
    periodQuarter: 2,
    kpiScore: 85.5,
    attitudeScore: 90,
    skillScore: 88,
    ...overrides,
  } as never;
}

async function captureError(
  run: () => Promise<unknown>,
): Promise<{ status: number; code: string }> {
  try {
    await run();
  } catch (error) {
    const exception = error as HttpException;
    const body = exception.getResponse() as { code: string };

    return { status: exception.getStatus(), code: body.code };
  }

  throw new Error('Expected the call to throw, but it resolved');
}

describe('PerformanceReviewsService', () => {
  let module: TestingModule;
  let service: PerformanceReviewsService;
  let repository: jest.Mocked<PerformanceReviewsRepository>;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        PerformanceReviewsService,
        {
          provide: PerformanceReviewsRepository,
          useValue: {
            findPaginated: jest.fn().mockResolvedValue([[], 0]),
            findById: jest.fn().mockResolvedValue(makeReview()),
            findByPeriod: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue(makeReview()),
            save: jest.fn((review: PerformanceReview) =>
              Promise.resolve(review),
            ),
            remove: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: EmployeesService,
          useValue: {
            findOne: jest.fn().mockResolvedValue({ id: EMPLOYEE_ID }),
            resolveScope: jest.fn().mockResolvedValue({ kind: 'all' }),
          },
        },
      ],
    }).compile();

    service = module.get(PerformanceReviewsService);
    repository = module.get(PerformanceReviewsRepository);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('điểm tổng và xếp loại do server tính', () => {
    it('derives the overall score and rating from the criteria', async () => {
      await service.create(makeDto(), managerUser);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          overallScore: '87.83',
          rating: ReviewRating.GOOD,
        }),
      );
    });

    /*
     * Sửa một tiêu chí phải đổi cả điểm tổng và xếp loại; không tính lại thì bản
     * đánh giá tự mâu thuẫn với chính nó — ba điểm nói một đằng, xếp loại một nẻo.
     */
    it('recomputes both when a single criterion is edited', async () => {
      repository.findById.mockResolvedValue(makeReview());

      await service.update(7, { kpiScore: 40 }, managerUser);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          overallScore: '72.67',
          rating: ReviewRating.AVERAGE,
        }),
      );
    });

    it('records the reviewer from the token, never from the body', async () => {
      await service.create(makeDto({ reviewerId: 999 }), managerUser);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ reviewerId: managerUser.employeeId }),
      );
    });

    /*
     * `reviewer_id` là NOT NULL và trỏ tới `employees`. Tài khoản admin seed sẵn
     * không gắn hồ sơ nào — nói thẳng ra thay vì để database đổ.
     */
    it('refuses a reviewer with no employee record', async () => {
      const error = await captureError(() =>
        service.create(makeDto(), adminUser),
      );

      expect(error).toEqual({
        status: 422,
        code: 'REVIEWER_HAS_NO_EMPLOYEE_RECORD',
      });
    });
  });

  describe('kỳ đánh giá', () => {
    /*
     * Hai bản cho cùng một người cùng một quý là hai sự thật khác nhau về cùng
     * một quãng thời gian, và không ai biết bản nào mới là bản chính.
     */
    it('refuses a second review for the same period', async () => {
      repository.findByPeriod.mockResolvedValue(makeReview({ id: 3 }));

      const error = await captureError(() =>
        service.create(makeDto(), managerUser),
      );

      expect(error).toEqual({ status: 409, code: 'REVIEW_PERIOD_TAKEN' });
    });

    it('refuses a quarterly review carrying a month', async () => {
      const error = await captureError(() =>
        service.create(makeDto({ periodMonth: 5 }), managerUser),
      );

      expect(error).toEqual({ status: 422, code: 'REVIEW_PERIOD_MISMATCH' });
    });

    it('refuses a quarterly review with no quarter', async () => {
      const error = await captureError(() =>
        service.create(makeDto({ periodQuarter: undefined }), managerUser),
      );

      expect(error).toEqual({ status: 422, code: 'REVIEW_PERIOD_MISMATCH' });
    });
  });

  describe('vòng đời draft → submitted → acknowledged', () => {
    it('submits a scored draft', async () => {
      const result = await service.submit(7, managerUser);

      expect(result.status).toBe(ReviewStatus.SUBMITTED);
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ReviewStatus.SUBMITTED }),
      );
    });

    /*
     * Bản chưa chấm điểm nào không nói lên điều gì về nhân viên, mà `submitted`
     * là khoá vĩnh viễn — chốt nó là khoá lại một tờ giấy trắng.
     */
    it('refuses to submit a draft with no score at all', async () => {
      repository.findById.mockResolvedValue(
        makeReview({
          kpiScore: null,
          attitudeScore: null,
          skillScore: null,
          overallScore: null,
          rating: null,
        }),
      );

      const error = await captureError(() => service.submit(7, managerUser));

      expect(error).toEqual({ status: 422, code: 'REVIEW_HAS_NO_SCORE' });
    });

    it('refuses to edit a review that is no longer a draft', async () => {
      repository.findById.mockResolvedValue(
        makeReview({ status: ReviewStatus.SUBMITTED }),
      );

      const error = await captureError(() =>
        service.update(7, { kpiScore: 100 }, managerUser),
      );

      expect(error).toEqual({ status: 409, code: 'REVIEW_NOT_DRAFT' });
    });

    it('records the acknowledgement of a submitted review', async () => {
      repository.findById.mockResolvedValue(
        makeReview({ status: ReviewStatus.SUBMITTED }),
      );

      await service.acknowledge(7, hrUser);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ReviewStatus.ACKNOWLEDGED }),
      );
    });

    it('refuses to acknowledge a review still in draft', async () => {
      const error = await captureError(() => service.acknowledge(7, hrUser));

      expect(error).toEqual({ status: 409, code: 'REVIEW_NOT_SUBMITTED' });
    });

    /*
     * Người ký tên dưới bản đánh giá không nên là người tự xác nhận mình đã
     * giao nó cho người được đánh giá.
     */
    it('refuses a manager recording the acknowledgement', async () => {
      repository.findById.mockResolvedValue(
        makeReview({ status: ReviewStatus.SUBMITTED }),
      );

      const error = await captureError(() =>
        service.acknowledge(7, managerUser),
      );

      expect(error).toEqual({ status: 403, code: 'FORBIDDEN' });
    });

    it('refuses to delete a review that was already submitted', async () => {
      repository.findById.mockResolvedValue(
        makeReview({ status: ReviewStatus.SUBMITTED }),
      );

      const error = await captureError(() => service.remove(7, managerUser));

      expect(error).toEqual({ status: 409, code: 'REVIEW_NOT_DRAFT' });
      expect(repository.remove).not.toHaveBeenCalled();
    });
  });

  describe('phạm vi', () => {
    it('limits a manager to their own departments', async () => {
      const employeesService = module.get(EmployeesService);

      (employeesService.resolveScope as unknown as jest.Mock).mockResolvedValue(
        { kind: 'department', departmentIds: [2, 3] },
      );

      await service.findAll({}, managerUser);

      expect(repository.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ departmentScope: [2, 3] }),
      );
    });
  });
});
