import { ReviewRating } from '@/modules/performance-reviews/entities/performance-review.entity';

/** Điểm tổng và xếp loại của một kỳ đánh giá. Hàm thuần, không chạm DB. */

/** Thang điểm 0–100 cho cả ba tiêu chí (api-spec.md §15 dùng 85.5 / 90 / 88). */
export const MIN_REVIEW_SCORE = 0;
export const MAX_REVIEW_SCORE = 100;

/** Ngưỡng xếp loại theo điểm tổng — quy ước nội bộ, không phải luật. */
export const RATING_THRESHOLDS: readonly {
  min: number;
  rating: ReviewRating;
}[] = [
  { min: 90, rating: ReviewRating.EXCELLENT },
  { min: 75, rating: ReviewRating.GOOD },
  { min: 60, rating: ReviewRating.AVERAGE },
  { min: 40, rating: ReviewRating.BELOW_AVERAGE },
  { min: 0, rating: ReviewRating.POOR },
];

export interface ReviewScores {
  kpiScore?: number | null;
  attitudeScore?: number | null;
  skillScore?: number | null;
}

export interface ReviewOutcome {
  /** `null` khi chưa chấm điểm nào — bản nháp chưa có gì để tổng kết. */
  overallScore: number | null;
  rating: ReviewRating | null;
}

/**
 * Trung bình các tiêu chí đã chấm (trọng số bằng nhau) và xếp loại tương ứng.
 *
 * Tiêu chí chưa chấm bị bỏ qua, không tính là 0.
 */
export function summariseReview(scores: ReviewScores): ReviewOutcome {
  const given = [
    scores.kpiScore,
    scores.attitudeScore,
    scores.skillScore,
  ].filter((value): value is number => typeof value === 'number');

  if (given.length === 0) {
    return { overallScore: null, rating: null };
  }

  const average = given.reduce((sum, value) => sum + value, 0) / given.length;
  // Hai chữ số thập phân — đúng độ chính xác của cột DECIMAL(5,2).
  const overallScore = Math.round(average * 100) / 100;

  return { overallScore, rating: ratingFor(overallScore) };
}

/** Xếp loại của một điểm tổng. Ngưỡng đọc từ cao xuống thấp, lấy mức đầu tiên đạt. */
export function ratingFor(overallScore: number): ReviewRating {
  const matched = RATING_THRESHOLDS.find(
    (threshold) => overallScore >= threshold.min,
  );

  return matched?.rating ?? ReviewRating.POOR;
}

/**
 * Kiểm `periodQuarter`/`periodMonth` có khớp loại kỳ không; trả về câu lỗi hoặc `null`.
 *
 * `monthly` cần tháng, `quarterly` và `biannual` cần quý, `annual` không cần gì.
 */
export function periodFieldsError(
  period: 'monthly' | 'quarterly' | 'biannual' | 'annual',
  quarter: number | null,
  month: number | null,
): string | null {
  const wants: Record<string, { quarter: boolean; month: boolean }> = {
    monthly: { quarter: false, month: true },
    quarterly: { quarter: true, month: false },
    // Nửa năm dùng lại cột quý: 1 = nửa đầu, 2 = nửa sau.
    biannual: { quarter: true, month: false },
    annual: { quarter: false, month: false },
  };

  const need = wants[period];

  if (need.quarter && quarter === null) {
    return `review period "${period}" requires periodQuarter`;
  }

  if (!need.quarter && quarter !== null) {
    return `review period "${period}" must not carry periodQuarter`;
  }

  if (need.month && month === null) {
    return `review period "${period}" requires periodMonth`;
  }

  if (!need.month && month !== null) {
    return `review period "${period}" must not carry periodMonth`;
  }

  if (period === 'biannual' && quarter !== null && quarter > 2) {
    return 'a biannual review uses periodQuarter 1 (first half) or 2 (second half)';
  }

  return null;
}
