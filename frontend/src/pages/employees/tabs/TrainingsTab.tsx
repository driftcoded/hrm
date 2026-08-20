import { Alert, Button, Empty, Skeleton, Table, Tag, type TableProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useEmployeeTrainings } from '@/hooks/useHrProcess';
import type {
  TrainingParticipant,
  TrainingResult,
} from '@/types/hr-process.types';
import { formatDate } from '@/utils/format';
import styles from './tabs.module.css';

/** Tab "Đào tạo" trong hồ sơ nhân viên — chỉ đọc; ghi danh làm ở trang khoá học. */
export interface TrainingsTabProps {
  employeeId: number;
}

const RESULT_COLORS: Record<TrainingResult, string> = {
  passed: 'green',
  failed: 'red',
  incomplete: 'orange',
  exempted: 'default',
};

export function TrainingsTab({ employeeId }: TrainingsTabProps) {
  const { t } = useTranslation();
  const resolveError = useApiErrorMessage();
  const list = useEmployeeTrainings(employeeId);

  const columns: TableProps<TrainingParticipant>['columns'] = [
    {
      title: t('hr.trainings.columns.course'),
      key: 'course',
      render: (_: unknown, record) => (
        <div className={styles.stackedCell}>
          <span>{record.training?.name ?? '—'}</span>
          <span className={styles.cellMeta}>
            {record.training?.code ?? ''}
            {record.training?.type
              ? ` · ${t(`hr.trainings.type.${record.training.type}`)}`
              : ''}
          </span>
        </div>
      ),
    },
    {
      title: t('hr.trainings.columns.registrationDate'),
      dataIndex: 'registrationDate',
      width: 130,
      render: (value: string) => formatDate(value),
    },
    {
      title: t('hr.trainings.columns.completionDate'),
      dataIndex: 'completionDate',
      width: 130,
      render: (value: string | null) => (value ? formatDate(value) : '—'),
    },
    {
      title: t('hr.trainings.columns.result'),
      dataIndex: 'result',
      width: 130,
      render: (value: TrainingResult | null) =>
        value === null ? (
          <span className={styles.muted}>{t('hr.trainings.notGraded')}</span>
        ) : (
          <Tag color={RESULT_COLORS[value]} bordered={false}>
            {t(`hr.trainings.result.${value}`)}
          </Tag>
        ),
    },
    {
      title: t('hr.trainings.columns.score'),
      dataIndex: 'score',
      width: 80,
      align: 'right',
      render: (value: number | null) => (
        <span className={styles.mono}>{value ?? '—'}</span>
      ),
    },
    {
      title: t('hr.trainings.columns.certificate'),
      dataIndex: 'certificateUrl',
      width: 120,
      render: (value: string | null) =>
        value ? (
          <a href={value} target="_blank" rel="noreferrer">
            {t('hr.trainings.openCertificate')}
          </a>
        ) : (
          '—'
        ),
    },
  ];

  if (list.isLoading) {
    return <Skeleton active paragraph={{ rows: 3 }} />;
  }

  if (list.isError) {
    return (
      <Alert
        type="error"
        showIcon
        title={resolveError(list.error) || t('hr.trainings.loadError')}
        action={
          <Button size="small" onClick={() => void list.refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  }

  const rows = list.data ?? [];

  if (rows.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t('hr.trainings.employeeEmpty')}
      />
    );
  }

  return (
    <Table<TrainingParticipant>
      rowKey="id"
      size="small"
      columns={columns}
      dataSource={rows}
      pagination={false}
      scroll={{ x: 800 }}
    />
  );
}
