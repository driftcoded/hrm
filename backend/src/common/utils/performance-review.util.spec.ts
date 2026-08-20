import { ReviewRating } from '@/modules/performance-reviews/entities/performance-review.entity';
import {
  RATING_THRESHOLDS,
  periodFieldsError,
  ratingFor,
  summariseReview,
} from './performance-review.util';

describe('summariseReview', () => {
  it('averages the three criteria with equal weight', () => {
    // Ví dụ của api-spec.md §15: 85.5 / 90 / 88 → 87.83.
    const result = summariseReview({
      kpiScore: 85.5,
      attitudeScore: 90,
      skillScore: 88,
    });

    expect(result.overallScore).toBe(87.83);
    expect(result.rating).toBe(ReviewRating.GOOD);
  });

  /*
   * Tiêu chí CHƯA CHẤM bị bỏ qua, không tính là 0. Một bản nháp mới chấm KPI mà
   * bị coi như thái độ và kỹ năng đều 0 sẽ hiện "kém" ngay trên màn hình người
   * đang chấm dở.
   */
  it('ignores criteria that have not been scored yet', () => {
    const result = summariseReview({ kpiScore: 90 });

    expect(result.overallScore).toBe(90);
    expect(result.rating).toBe(ReviewRating.EXCELLENT);
  });

  it('reports nothing at all when no criterion has a score', () => {
    expect(summariseReview({})).toEqual({
      overallScore: null,
      rating: null,
    });
  });

  it('treats a score of zero as a real score, not as missing', () => {
    const result = summariseReview({ kpiScore: 0, attitudeScore: 60 });

    expect(result.overallScore).toBe(30);
    expect(result.rating).toBe(ReviewRating.POOR);
  });

  /* Cột DECIMAL(5,2) — làm tròn hai chữ số ngay ở đây để khớp với thứ sẽ lưu. */
  it('rounds to the two decimals the column can hold', () => {
    expect(
      summariseReview({ kpiScore: 1, attitudeScore: 2 }).overallScore,
    ).toBe(1.5);
    expect(
      summariseReview({ kpiScore: 1, attitudeScore: 1, skillScore: 2 })
        .overallScore,
    ).toBe(1.33);
  });
});

describe('ratingFor', () => {
  it.each([
    [100, ReviewRating.EXCELLENT],
    [90, ReviewRating.EXCELLENT],
    [89.99, ReviewRating.GOOD],
    [75, ReviewRating.GOOD],
    [60, ReviewRating.AVERAGE],
    [40, ReviewRating.BELOW_AVERAGE],
    [39.99, ReviewRating.POOR],
    [0, ReviewRating.POOR],
  ])('maps %s to %s', (score, expected) => {
    expect(ratingFor(score)).toBe(expected);
  });

  /*
   * Ngưỡng phải LIỀN MẠCH và phủ kín 0–100: một khoảng hở nghĩa là có điểm
   * không xếp loại được, và thứ tự đảo nghĩa là mức cao bị mức thấp bắt trước.
   */
  it('covers every score without a gap', () => {
    const mins = RATING_THRESHOLDS.map((threshold) => threshold.min);

    expect(mins).toEqual([...mins].sort((a, b) => b - a));
    expect(mins[mins.length - 1]).toBe(0);

    for (let score = 0; score <= 100; score += 0.5) {
      expect(ratingFor(score)).toBeDefined();
    }
  });
});

describe('periodFieldsError', () => {
  it('accepts the field combination each period actually needs', () => {
    expect(periodFieldsError('monthly', null, 5)).toBeNull();
    expect(periodFieldsError('quarterly', 2, null)).toBeNull();
    expect(periodFieldsError('biannual', 1, null)).toBeNull();
    expect(periodFieldsError('annual', null, null)).toBeNull();
  });

  /*
   * "Quý 2, tháng 7" không đọc được là kỳ nào, và khi hai kỳ chồng nhau thì
   * không ai biết đánh giá nào mới là của quý đó.
   */
  it('rejects a quarter carried on a monthly review', () => {
    expect(periodFieldsError('monthly', 2, 5)).toContain('periodQuarter');
  });

  it('rejects a month carried on a quarterly review', () => {
    expect(periodFieldsError('quarterly', 2, 5)).toContain('periodMonth');
  });

  it('rejects a missing quarter on a quarterly review', () => {
    expect(periodFieldsError('quarterly', null, null)).toContain(
      'requires periodQuarter',
    );
  });

  it('rejects any period field on an annual review', () => {
    expect(periodFieldsError('annual', 1, null)).not.toBeNull();
    expect(periodFieldsError('annual', null, 12)).not.toBeNull();
  });

  /* Nửa năm dùng lại cột quý: 1 = nửa đầu, 2 = nửa sau. */
  it('limits a biannual review to halves 1 and 2', () => {
    expect(periodFieldsError('biannual', 2, null)).toBeNull();
    expect(periodFieldsError('biannual', 3, null)).toContain('first half');
  });
});
