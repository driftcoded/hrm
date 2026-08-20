import { useState } from 'react';
import { App, Button, InputNumber, Popconfirm, Select, Space, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { DataTableCard } from '@/components/crud/DataTableCard';
import { ReviewFormModal } from '@/components/hr/ReviewFormModal';
import {
  ReviewRatingTag,
  ReviewStatusTag,
} from '@/components/hr/ReviewRatingTag';
import { PageHeader } from '@/components/layout/PageHeader';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useReviewMutations, useReviews } from '@/hooks/useHrProcess';
import {
  useCanAcknowledgeReview,
  useCanWriteReview,
} from '@/hooks/usePermissions';
import { parseEnumParam, parseIntParam, useTableQuery } from '@/hooks/useTableQuery';
import {
  REVIEW_PERIODS,
  REVIEW_RATINGS,
  REVIEW_STATUSES,
  type PerformanceReview,
  type ReviewPeriod,
  type ReviewRating,
  type ReviewStatus,
} from '@/types/hr-process.types';
import { periodLabel } from '@/utils/review';
import styles from './PerformancePage.module.css';

/**
 * `/performance` — mọi kỳ đánh giá, xem theo toàn công ty (PLAN 7.2).
 *
 * Danh sách đã được backend cắt theo phạm vi của người đăng nhập: `manager` chỉ
 * thấy phòng mình. Không lọc lại ở đây — thêm một lớp lọc thứ hai chỉ tạo ra hai
 * nguồn sự thật cho cùng một câu hỏi.
 */
export function PerformancePage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();

  const canWrite = useCanWriteReview();
  const canAcknowledge = useCanAcknowledgeReview();
  const table = useTableQuery({});

  const status = parseEnumParam(table.filters.status, REVIEW_STATUSES);
  const rating = parseEnumParam(table.filters.rating, REVIEW_RATINGS);
  const reviewPeriod = parseEnumParam(table.filters.reviewPeriod, REVIEW_PERIODS);
  const periodYear = parseIntParam(table.filters.periodYear);

  const list = useReviews({
    page: table.page,
    limit: table.pageSize,
    status,
    rating,
    reviewPeriod,
    periodYear,
  });
  const mutations = useReviewMutations();

  const [isFormOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PerformanceReview | null>(null);

  const rows = list.data?.items ?? [];
  const total = list.data?.meta.total ?? 0;
  const hasFilters =
    status !== undefined ||
    rating !== undefined ||
    reviewPeriod !== undefined ||
    periodYear !== undefined;

  const run = (action: () => Promise<unknown>, successKey: string) => {
    void (async () => {
      try {
        await action();
        message.success(t(successKey));
      } catch (error) {
        message.error(resolveError(error));
      }
    })();
  };

  const openForm = (review: PerformanceReview | null) => {
    setEditing(review);
    setFormOpen(true);
  };

  const columns: ColumnsType<PerformanceReview> = [
    {
      title: t('hr.reviews.columns.employee'),
      key: 'employee',
      render: (_: unknown, record) => (
        <div className={styles.person}>
          <span>{record.employee.fullName}</span>
          <span className={styles.personMeta}>
            {record.employee.employeeCode}
            {record.employee.departmentName
              ? ` · ${record.employee.departmentName}`
              : ''}
          </span>
        </div>
      ),
    },
    {
      title: t('hr.reviews.columns.period'),
      key: 'period',
      width: 120,
      render: (_: unknown, record) => periodLabel(record, t),
    },
    {
      title: t('hr.reviews.columns.overall'),
      dataIndex: 'overallScore',
      width: 90,
      align: 'right',
      render: (value: number | null) => (
        <strong className={styles.mono}>{value ?? '—'}</strong>
      ),
    },
    {
      title: t('hr.reviews.columns.rating'),
      dataIndex: 'rating',
      width: 120,
      render: (_: unknown, record) => <ReviewRatingTag rating={record.rating} />,
    },
    {
      title: t('hr.reviews.columns.reviewer'),
      dataIndex: 'reviewerName',
      width: 160,
      render: (value: string | null) => value ?? '—',
    },
    {
      title: t('hr.reviews.columns.status'),
      dataIndex: 'status',
      width: 130,
      render: (_: unknown, record) => <ReviewStatusTag status={record.status} />,
    },
    {
      title: '',
      key: 'actions',
      width: 130,
      render: (_: unknown, record) => (
        <Space size={0}>
          {canWrite && record.status === 'draft' && (
            <>
              <Tooltip title={t('common.edit')}>
                <Button
                  size="small"
                  type="text"
                  icon={<EditOutlined />}
                  aria-label={t('common.edit')}
                  onClick={() => openForm(record)}
                />
              </Tooltip>
              <Popconfirm
                title={t('hr.reviews.submitConfirm')}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                onConfirm={() =>
                  run(
                    () => mutations.submitReview(record.id),
                    'hr.reviews.submitSuccess',
                  )
                }
              >
                <Tooltip title={t('hr.reviews.submit')}>
                  <Button
                    size="small"
                    type="text"
                    icon={<CheckOutlined />}
                    aria-label={t('hr.reviews.submit')}
                    loading={mutations.isSubmitting}
                  />
                </Tooltip>
              </Popconfirm>
              <Popconfirm
                title={t('hr.reviews.deleteConfirm')}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                onConfirm={() =>
                  run(
                    () => mutations.deleteReview(record.id),
                    'hr.reviews.deleteSuccess',
                  )
                }
              >
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={t('common.delete')}
                  loading={mutations.isDeleting}
                />
              </Popconfirm>
            </>
          )}

          {canAcknowledge && record.status === 'submitted' && (
            <Tooltip title={t('hr.reviews.acknowledge')}>
              <Button
                size="small"
                type="text"
                icon={<SafetyCertificateOutlined />}
                aria-label={t('hr.reviews.acknowledge')}
                loading={mutations.isAcknowledging}
                onClick={() =>
                  run(
                    () => mutations.acknowledgeReview(record.id),
                    'hr.reviews.acknowledgeSuccess',
                  )
                }
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title={t('hr.reviews.title')}
        subtitle={t('hr.reviews.subtitle')}
      />

      <DataTableCard<PerformanceReview>
        columns={columns}
        rows={rows}
        isLoading={list.isLoading}
        isRefreshing={list.isFetching && !list.isLoading}
        isError={list.isError}
        onRetry={list.refetch}
        errorMessage={t('hr.reviews.loadError')}
        hasFilters={hasFilters}
        total={total}
        scrollX={1100}
        pagination={{
          page: table.page,
          pageSize: table.pageSize,
          total,
          onChange: table.setPagination,
        }}
        filters={
          <>
            <InputNumber
              className={styles.yearInput}
              placeholder={t('hr.reviews.filters.year')}
              min={2026}
              max={2100}
              value={periodYear ?? null}
              onChange={(value) =>
                table.setFilter('periodYear', value ?? undefined)
              }
            />
            <Select
              allowClear
              className={styles.filterSelect}
              placeholder={t('hr.reviews.filters.period')}
              value={reviewPeriod}
              onChange={(value?: ReviewPeriod) =>
                table.setFilter('reviewPeriod', value)
              }
              options={REVIEW_PERIODS.map((value) => ({
                value,
                label: t(`hr.reviews.period.${value}`),
              }))}
            />
            <Select
              allowClear
              className={styles.filterSelect}
              placeholder={t('hr.reviews.filters.status')}
              value={status}
              onChange={(value?: ReviewStatus) =>
                table.setFilter('status', value)
              }
              options={REVIEW_STATUSES.map((value) => ({
                value,
                label: t(`hr.reviews.status.${value}`),
              }))}
            />
            <Select
              allowClear
              className={styles.filterSelect}
              placeholder={t('hr.reviews.filters.rating')}
              value={rating}
              onChange={(value?: ReviewRating) =>
                table.setFilter('rating', value)
              }
              options={REVIEW_RATINGS.map((value) => ({
                value,
                label: t(`hr.reviews.rating.${value}`),
              }))}
            />
            <Button
              type="link"
              icon={<ReloadOutlined />}
              disabled={!hasFilters}
              onClick={() => {
                table.setFilter('periodYear', undefined);
                table.setFilter('reviewPeriod', undefined);
                table.setFilter('status', undefined);
                table.setFilter('rating', undefined);
              }}
            >
              {t('payroll.filters.reset')}
            </Button>
          </>
        }
        actions={
          canWrite && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openForm(null)}
            >
              {t('hr.reviews.create')}
            </Button>
          )
        }
      />

      <ReviewFormModal
        open={isFormOpen}
        review={editing}
        onClose={() => setFormOpen(false)}
      />
    </div>
  );
}
