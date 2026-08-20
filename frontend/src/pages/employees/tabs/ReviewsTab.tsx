import { useState } from 'react';
import {
  Alert,
  App,
  Button,
  Empty,
  Popconfirm,
  Skeleton,
  Space,
  Table,
  Tooltip,
  type TableProps,
} from 'antd';
import {
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { ReviewFormModal } from '@/components/hr/ReviewFormModal';
import {
  ReviewRatingTag,
  ReviewStatusTag,
} from '@/components/hr/ReviewRatingTag';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useReviewMutations, useReviews } from '@/hooks/useHrProcess';
import {
  useCanAcknowledgeReview,
  useCanWriteReview,
} from '@/hooks/usePermissions';
import type { PerformanceReview } from '@/types/hr-process.types';
import { periodLabel } from '@/utils/review';
import styles from './tabs.module.css';

/** Tab "Đánh giá" trong hồ sơ nhân viên — mọi kỳ đánh giá của người đó. */
export interface ReviewsTabProps {
  employeeId: number;
}

export function ReviewsTab({ employeeId }: ReviewsTabProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();

  const canWrite = useCanWriteReview();
  const canAcknowledge = useCanAcknowledgeReview();

  const list = useReviews({ employeeId, limit: 100 });
  const mutations = useReviewMutations();

  const [isFormOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PerformanceReview | null>(null);

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

  const columns: TableProps<PerformanceReview>['columns'] = [
    {
      title: t('hr.reviews.columns.period'),
      key: 'period',
      width: 130,
      render: (_: unknown, record) => periodLabel(record, t),
    },
    {
      title: t('hr.reviews.columns.scores'),
      key: 'scores',
      width: 180,
      render: (_: unknown, record) => (
        <span className={styles.mono}>
          {[record.kpiScore, record.attitudeScore, record.skillScore]
            .map((value) => value ?? '—')
            .join(' · ')}
        </span>
      ),
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

  if (list.isLoading) {
    return <Skeleton active paragraph={{ rows: 4 }} />;
  }

  if (list.isError) {
    return (
      <Alert
        type="error"
        showIcon
        title={resolveError(list.error) || t('hr.reviews.loadError')}
        action={
          <Button size="small" onClick={() => void list.refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  }

  const rows = list.data?.items ?? [];

  return (
    <div className={styles.tab}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarSpacer} />
        {canWrite && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openForm(null)}
          >
            {t('hr.reviews.create')}
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('hr.reviews.empty')}
        />
      ) : (
        <Table<PerformanceReview>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={rows}
          pagination={false}
          scroll={{ x: 950 }}
          expandable={{
            expandedRowRender: (record) => (
              <div className={styles.expanded}>
                {record.strengths && (
                  <p>
                    <strong>{t('hr.reviews.fields.strengths')}: </strong>
                    {record.strengths}
                  </p>
                )}
                {record.weaknesses && (
                  <p>
                    <strong>{t('hr.reviews.fields.weaknesses')}: </strong>
                    {record.weaknesses}
                  </p>
                )}
                {record.recommendations && (
                  <p>
                    <strong>{t('hr.reviews.fields.recommendations')}: </strong>
                    {record.recommendations}
                  </p>
                )}
                {record.note && <p className={styles.cellMeta}>{record.note}</p>}
              </div>
            ),
          }}
        />
      )}

      <ReviewFormModal
        open={isFormOpen}
        review={editing}
        lockedEmployeeId={employeeId}
        onClose={() => setFormOpen(false)}
      />
    </div>
  );
}
