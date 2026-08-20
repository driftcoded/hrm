import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ReviewRating, ReviewStatus } from '@/types/hr-process.types';

/** Xếp loại của một kỳ đánh giá. */
const RATING_COLORS: Record<ReviewRating, string> = {
  excellent: 'green',
  good: 'blue',
  average: 'default',
  below_average: 'orange',
  poor: 'red',
};

export function ReviewRatingTag({ rating }: { rating: ReviewRating | null }) {
  const { t } = useTranslation();

  if (rating === null) {
    return <span>—</span>;
  }

  return (
    <Tag color={RATING_COLORS[rating]} bordered={false}>
      {t(`hr.reviews.rating.${rating}`)}
    </Tag>
  );
}

/** Trạng thái của một bản đánh giá. */
const STATUS_COLORS: Record<ReviewStatus, string> = {
  draft: 'default',
  submitted: 'blue',
  acknowledged: 'green',
};

export function ReviewStatusTag({ status }: { status: ReviewStatus }) {
  const { t } = useTranslation();

  return (
    <Tag color={STATUS_COLORS[status]} bordered={false}>
      {t(`hr.reviews.status.${status}`)}
    </Tag>
  );
}
