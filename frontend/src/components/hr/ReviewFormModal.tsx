import { useEffect, useMemo, useState } from 'react';
import { Alert, App, Col, Form, Input, InputNumber, Modal, Row, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { EmployeeSelect } from '@/components/employees/EmployeeSelect';
import { ReviewRatingTag } from '@/components/hr/ReviewRatingTag';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useReviewMutations } from '@/hooks/useHrProcess';
import {
  REVIEW_PERIODS,
  type PerformanceReview,
  type ReviewPeriod,
  type ReviewRating,
} from '@/types/hr-process.types';
import styles from './ReviewFormModal.module.css';

/**
 * Form chấm điểm một kỳ đánh giá.
 *
 * Điểm tổng và xếp loại hiện ngay khi gõ, nhưng server mới là nơi tính con số
 * được lưu — cùng công thức, nêu rõ ở nhãn.
 */
export interface ReviewFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Có giá trị = sửa bản nháp đó; `null` = tạo mới. */
  review?: PerformanceReview | null;
  /** Khoá sẵn nhân viên khi mở từ hồ sơ của họ. */
  lockedEmployeeId?: number;
}

interface FormValues {
  employeeId: number;
  reviewPeriod: ReviewPeriod;
  periodYear: number;
  periodQuarter?: number;
  periodMonth?: number;
  kpiScore?: number;
  attitudeScore?: number;
  skillScore?: number;
  strengths?: string;
  weaknesses?: string;
  recommendations?: string;
  note?: string;
}

/** Ngưỡng xếp loại — giữ khớp với `RATING_THRESHOLDS` ở backend. */
function ratingFor(score: number): ReviewRating {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'average';
  if (score >= 40) return 'below_average';
  return 'poor';
}

/** Trung bình các tiêu chí đã chấm; tiêu chí bỏ trống không tính là 0. */
function summarise(scores: (number | undefined)[]): {
  overall: number | null;
  rating: ReviewRating | null;
} {
  const given = scores.filter(
    (value): value is number => typeof value === 'number',
  );

  if (given.length === 0) {
    return { overall: null, rating: null };
  }

  const average =
    given.reduce((sum, value) => sum + value, 0) / given.length;
  const overall = Math.round(average * 100) / 100;

  return { overall, rating: ratingFor(overall) };
}

export function ReviewFormModal({
  open,
  onClose,
  review = null,
  lockedEmployeeId,
}: ReviewFormModalProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();
  const [form] = Form.useForm<FormValues>();
  const mutations = useReviewMutations();
  const [error, setError] = useState<string | null>(null);

  const isEdit = review !== null;
  const period = Form.useWatch('reviewPeriod', form);
  const kpi = Form.useWatch('kpiScore', form);
  const attitude = Form.useWatch('attitudeScore', form);
  const skill = Form.useWatch('skillScore', form);

  const preview = useMemo(
    () => summarise([kpi, attitude, skill]),
    [kpi, attitude, skill],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setError(null);
    form.resetFields();

    if (review) {
      form.setFieldsValue({
        reviewPeriod: review.reviewPeriod,
        periodYear: review.periodYear,
        periodQuarter: review.periodQuarter ?? undefined,
        periodMonth: review.periodMonth ?? undefined,
        kpiScore: review.kpiScore ?? undefined,
        attitudeScore: review.attitudeScore ?? undefined,
        skillScore: review.skillScore ?? undefined,
        strengths: review.strengths ?? undefined,
        weaknesses: review.weaknesses ?? undefined,
        recommendations: review.recommendations ?? undefined,
        note: review.note ?? undefined,
      });
    } else {
      form.setFieldsValue({
        reviewPeriod: 'quarterly',
        periodYear: new Date().getFullYear(),
        employeeId: lockedEmployeeId,
      });
    }
  }, [open, review, lockedEmployeeId, form]);

  const handleSubmit = (values: FormValues) => {
    void (async () => {
      setError(null);

      /*
       * Chỉ gửi trường kỳ mà loại kỳ đó cần — backend từ chối "quý 2, tháng 7".
       */
      const payload = {
        reviewPeriod: values.reviewPeriod,
        periodYear: values.periodYear,
        periodQuarter:
          values.reviewPeriod === 'quarterly' ||
          values.reviewPeriod === 'biannual'
            ? values.periodQuarter
            : undefined,
        periodMonth:
          values.reviewPeriod === 'monthly' ? values.periodMonth : undefined,
        kpiScore: values.kpiScore,
        attitudeScore: values.attitudeScore,
        skillScore: values.skillScore,
        strengths: values.strengths?.trim() || undefined,
        weaknesses: values.weaknesses?.trim() || undefined,
        recommendations: values.recommendations?.trim() || undefined,
        note: values.note?.trim() || undefined,
      };

      try {
        if (review) {
          await mutations.updateReview({ id: review.id, payload });
        } else {
          await mutations.createReview({
            ...payload,
            employeeId: lockedEmployeeId ?? values.employeeId,
          });
        }

        onClose();
        message.success(
          t(isEdit ? 'hr.reviews.updateSuccess' : 'hr.reviews.createSuccess'),
        );
      } catch (submitError) {
        setError(resolveError(submitError));
      }
    })();
  };

  const needsQuarter = period === 'quarterly' || period === 'biannual';
  const needsMonth = period === 'monthly';

  return (
    <Modal
      open={open}
      title={t(isEdit ? 'hr.reviews.edit' : 'hr.reviews.create')}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      confirmLoading={mutations.isCreating || mutations.isUpdating}
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
      width={680}
    >
      {error && (
        <Alert type="error" showIcon title={error} className={styles.error} />
      )}

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        {!isEdit && lockedEmployeeId === undefined && (
          <Form.Item
            name="employeeId"
            label={t('hr.reviews.fields.employee')}
            rules={[
              { required: true, message: t('hr.reviews.errors.employee') },
            ]}
          >
            <EmployeeSelect
              enabled={open}
              placeholder={t('hr.reviews.fields.employeePlaceholder')}
            />
          </Form.Item>
        )}

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="reviewPeriod"
              label={t('hr.reviews.fields.period')}
            >
              <Select
                options={REVIEW_PERIODS.map((value) => ({
                  value,
                  label: t(`hr.reviews.period.${value}`),
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="periodYear"
              label={t('hr.reviews.fields.year')}
              rules={[{ required: true, message: t('hr.reviews.errors.year') }]}
            >
              <InputNumber min={2026} max={2100} className={styles.control} />
            </Form.Item>
          </Col>
          <Col span={8}>
            {needsQuarter && (
              <Form.Item
                name="periodQuarter"
                label={t(
                  period === 'biannual'
                    ? 'hr.reviews.fields.half'
                    : 'hr.reviews.fields.quarter',
                )}
                rules={[
                  { required: true, message: t('hr.reviews.errors.quarter') },
                ]}
              >
                <Select
                  options={(period === 'biannual' ? [1, 2] : [1, 2, 3, 4]).map(
                    (value) => ({ value, label: String(value) }),
                  )}
                />
              </Form.Item>
            )}
            {needsMonth && (
              <Form.Item
                name="periodMonth"
                label={t('hr.reviews.fields.month')}
                rules={[
                  { required: true, message: t('hr.reviews.errors.month') },
                ]}
              >
                <Select
                  options={Array.from({ length: 12 }, (_, index) => ({
                    value: index + 1,
                    label: String(index + 1),
                  }))}
                />
              </Form.Item>
            )}
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="kpiScore" label={t('hr.reviews.fields.kpi')}>
              <InputNumber min={0} max={100} className={styles.control} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="attitudeScore"
              label={t('hr.reviews.fields.attitude')}
            >
              <InputNumber min={0} max={100} className={styles.control} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="skillScore" label={t('hr.reviews.fields.skill')}>
              <InputNumber min={0} max={100} className={styles.control} />
            </Form.Item>
          </Col>
        </Row>

        <div className={styles.preview}>
          <span>{t('hr.reviews.overallPreview')}</span>
          <strong className={styles.previewScore}>
            {preview.overall ?? '—'}
          </strong>
          <ReviewRatingTag rating={preview.rating} />
        </div>
        <p className={styles.hint}>{t('hr.reviews.overallHint')}</p>

        <Form.Item name="strengths" label={t('hr.reviews.fields.strengths')}>
          <Input.TextArea rows={2} maxLength={2000} />
        </Form.Item>

        <Form.Item name="weaknesses" label={t('hr.reviews.fields.weaknesses')}>
          <Input.TextArea rows={2} maxLength={2000} />
        </Form.Item>

        <Form.Item
          name="recommendations"
          label={t('hr.reviews.fields.recommendations')}
        >
          <Input.TextArea rows={2} maxLength={2000} />
        </Form.Item>

        <Form.Item name="note" label={t('hr.reviews.fields.note')}>
          <Input.TextArea rows={2} maxLength={1000} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
