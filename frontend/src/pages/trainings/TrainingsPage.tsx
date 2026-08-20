import { useState } from 'react';
import { App, Button, Input, Popconfirm, Select, Space, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { DataTableCard } from '@/components/crud/DataTableCard';
import { TrainingFormModal } from '@/components/hr/TrainingFormModal';
import { TrainingParticipantsDrawer } from '@/components/hr/TrainingParticipantsDrawer';
import { PageHeader } from '@/components/layout/PageHeader';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useTrainingMutations, useTrainings } from '@/hooks/useHrProcess';
import { useCanWriteTraining } from '@/hooks/usePermissions';
import { parseEnumParam, useTableQuery } from '@/hooks/useTableQuery';
import { formatCurrency, formatDate } from '@/utils/format';
import {
  TRAINING_STATUSES,
  TRAINING_TYPES,
  type Training,
  type TrainingStatus,
  type TrainingType,
} from '@/types/hr-process.types';
import styles from './TrainingsPage.module.css';

/**
 * `/trainings` — danh mục khoá đào tạo (PLAN 7.2).
 *
 * Học viên KHÔNG nằm trong bảng này mà trong ngăn kéo mở từ nút "Học viên": một
 * khoá có thể có vài chục người, nhồi vào một cột thì không đọc được và cũng
 * không thao tác được.
 */
export function TrainingsPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();

  const canWrite = useCanWriteTraining();
  const table = useTableQuery({});

  const status = parseEnumParam(table.filters.status, TRAINING_STATUSES);
  const type = parseEnumParam(table.filters.type, TRAINING_TYPES);
  const search = table.filters.search || undefined;

  const list = useTrainings({
    page: table.page,
    limit: table.pageSize,
    status,
    type,
    search,
  });
  const mutations = useTrainingMutations();

  const [isFormOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Training | null>(null);
  const [viewing, setViewing] = useState<Training | null>(null);

  const rows = list.data?.items ?? [];
  const total = list.data?.meta.total ?? 0;
  const hasFilters =
    status !== undefined || type !== undefined || search !== undefined;

  const openForm = (training: Training | null) => {
    setEditing(training);
    setFormOpen(true);
  };

  const handleDelete = (training: Training) => {
    void (async () => {
      try {
        await mutations.deleteTraining(training.id);
        message.success(t('hr.trainings.deleteSuccess'));
      } catch (error) {
        message.error(resolveError(error));
      }
    })();
  };

  const columns: ColumnsType<Training> = [
    {
      title: t('hr.trainings.columns.course'),
      key: 'course',
      render: (_: unknown, record) => (
        <div className={styles.course}>
          <span>{record.name}</span>
          <span className={styles.courseMeta}>
            {record.code} · {t(`hr.trainings.type.${record.type}`)}
          </span>
        </div>
      ),
    },
    {
      title: t('hr.trainings.columns.range'),
      key: 'range',
      width: 190,
      render: (_: unknown, record) =>
        record.startDate === null && record.endDate === null ? (
          <span className={styles.muted}>{t('hr.trainings.noSchedule')}</span>
        ) : (
          <span className={styles.mono}>
            {record.startDate ? formatDate(record.startDate) : '…'} –{' '}
            {record.endDate ? formatDate(record.endDate) : '…'}
          </span>
        ),
    },
    {
      title: t('hr.trainings.columns.trainer'),
      dataIndex: 'trainer',
      width: 160,
      render: (value: string | null) => value ?? '—',
    },
    {
      title: t('hr.trainings.columns.participants'),
      key: 'participants',
      width: 110,
      align: 'right',
      render: (_: unknown, record) => (
        <span className={styles.mono}>
          {record.participantCount}
          {record.maxParticipants !== null ? ` / ${record.maxParticipants}` : ''}
        </span>
      ),
    },
    {
      title: t('hr.trainings.columns.cost'),
      dataIndex: 'cost',
      width: 130,
      align: 'right',
      render: (value: number) =>
        value > 0 ? (
          <span className={styles.mono}>{formatCurrency(value)}</span>
        ) : (
          <span className={styles.muted}>—</span>
        ),
    },
    {
      title: t('hr.trainings.columns.status'),
      dataIndex: 'status',
      width: 120,
      render: (value: TrainingStatus) => (
        <Tag color={STATUS_COLORS[value]} bordered={false}>
          {t(`hr.trainings.status.${value}`)}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (_: unknown, record) => (
        <Space size={0}>
          <Tooltip title={t('hr.trainings.participants')}>
            <Button
              size="small"
              type="text"
              icon={<TeamOutlined />}
              aria-label={t('hr.trainings.participants')}
              onClick={() => setViewing(record)}
            />
          </Tooltip>

          {canWrite && (
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
                title={t('hr.trainings.deleteConfirm')}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                onConfirm={() => handleDelete(record)}
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
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title={t('hr.trainings.title')}
        subtitle={t('hr.trainings.subtitle')}
      />

      <DataTableCard<Training>
        columns={columns}
        rows={rows}
        isLoading={list.isLoading}
        isRefreshing={list.isFetching && !list.isLoading}
        isError={list.isError}
        onRetry={list.refetch}
        errorMessage={t('hr.trainings.loadError')}
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
            <Input.Search
              allowClear
              className={styles.search}
              placeholder={t('hr.trainings.filters.search')}
              defaultValue={search}
              onSearch={(value) => table.setFilter('search', value || undefined)}
            />
            <Select
              allowClear
              className={styles.filterSelect}
              placeholder={t('hr.trainings.filters.status')}
              value={status}
              onChange={(value?: TrainingStatus) =>
                table.setFilter('status', value)
              }
              options={TRAINING_STATUSES.map((value) => ({
                value,
                label: t(`hr.trainings.status.${value}`),
              }))}
            />
            <Select
              allowClear
              className={styles.filterSelect}
              placeholder={t('hr.trainings.filters.type')}
              value={type}
              onChange={(value?: TrainingType) => table.setFilter('type', value)}
              options={TRAINING_TYPES.map((value) => ({
                value,
                label: t(`hr.trainings.type.${value}`),
              }))}
            />
            <Button
              type="link"
              icon={<ReloadOutlined />}
              disabled={!hasFilters}
              onClick={() => {
                table.setFilter('search', undefined);
                table.setFilter('status', undefined);
                table.setFilter('type', undefined);
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
              {t('hr.trainings.create')}
            </Button>
          )
        }
      />

      <TrainingFormModal
        open={isFormOpen}
        training={editing}
        onClose={() => setFormOpen(false)}
      />

      <TrainingParticipantsDrawer
        training={viewing}
        canWrite={canWrite}
        onClose={() => setViewing(null)}
      />
    </div>
  );
}

/** `completed` xám vì đã xong — không còn việc gì để làm với nó. */
const STATUS_COLORS: Record<TrainingStatus, string> = {
  planned: 'blue',
  ongoing: 'gold',
  completed: 'default',
  cancelled: 'red',
};
