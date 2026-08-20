import type { PerformanceReview } from '@/types/hr-process.types';

/** Nhãn kỳ đánh giá: "Quý 2/2026", "Tháng 5/2026", "Năm 2026". */
export function periodLabel(
  review: Pick<
    PerformanceReview,
    'reviewPeriod' | 'periodYear' | 'periodQuarter' | 'periodMonth'
  >,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (review.reviewPeriod === 'annual') {
    return t('hr.reviews.periodLabel.annual', { year: review.periodYear });
  }

  if (review.reviewPeriod === 'monthly') {
    return t('hr.reviews.periodLabel.monthly', {
      month: review.periodMonth,
      year: review.periodYear,
    });
  }

  return t(
    review.reviewPeriod === 'biannual'
      ? 'hr.reviews.periodLabel.biannual'
      : 'hr.reviews.periodLabel.quarterly',
    { part: review.periodQuarter, year: review.periodYear },
  );
}
