import { useEffect, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Drawer,
  Empty,
  Form,
  Popconfirm,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  type TableProps,
} from 'antd';
import {
  DeleteOutlined,
  TrophyOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { EmployeeSelect } from '@/components/employees/EmployeeSelect';
import { CompleteParticipantModal } from '@/components/hr/CompleteParticipantModal';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import {
  useTrainingMutations,
  useTrainingParticipants,
} from '@/hooks/useHrProcess';
import {
  type Training,
  type TrainingParticipant,
  type TrainingResult,
} from '@/types/hr-process.types';
import { formatDate } from '@/utils/format';
import styles from './TrainingParticipantsDrawer.module.css';

/**
 * Danh sách học viên của một khoá — ghi danh, chấm kết quả, gỡ tên.
 *
 * Ghi danh nhận NHIỀU người một lần và người đã có trong khoá được bỏ qua chứ
 * không làm hỏng cả lượt: backend trả lại danh sách bị trùng để báo lại ở đây.
 */
export interface TrainingParticipantsDrawerProps {
  training: Training | null;
  canWrite: boolean;
  onClose: () => void;
}

const RESULT_COLORS: Record<TrainingResult, string> = {
  passed: 'green',
  failed: 'red',
  incomplete: 'orange',
  exempted: 'default',
};

export function TrainingParticipantsDrawer({
  training,
  canWrite,
  onClose,
}: TrainingParticipantsDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();
  const [form] = Form.useForm<{ employeeIds: number[] }>();

  const trainingId = training?.id ?? null;
  const list = useTrainingParticipants(trainingId);
  const mutations = useTrainingMutations();

  const [grading, setGrading] = useState<TrainingParticipant | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (training) {
      setError(null);
      form.resetFields();
    }
  }, [training, form]);

  const handleEnroll = (values: { employeeIds: number[] }) => {
    void (async () => {
      if (trainingId === null || values.employeeIds.length === 0) {
        return;
      }

      setError(null);

      try {
        const result = await mutations.enrollEmployees({
          trainingId,
          employeeIds: values.employeeIds,
        });

        form.resetFields();

        if (result.alreadyEnrolled.length > 0) {
          message.warning(
            t('hr.trainings.enrollPartial', {
              n: result.enrolled,
              skipped: result.alreadyEnrolled.join(', '),
            }),
          );
        } else {
          message.success(
            t('hr.trainings.enrollSuccess', { n: result.enrolled }),
          );
        }
      } catch (enrollError) {
        setError(resolveError(enrollError));
      }
    })();
  };

  const handleUnenroll = (participant: TrainingParticipant) => {
    void (async () => {
      if (trainingId === null) {
        return;
      }

      try {
        await mutations.unenrollParticipant({
          trainingId,
          employeeId: participant.employeeId,
        });
        message.success(t('hr.trainings.unenrollSuccess'));
      } catch (unenrollError) {
        message.error(resolveError(unenrollError));
      }
    })();
  };

  const columns: TableProps<TrainingParticipant>['columns'] = [
    {
      title: t('hr.trainings.columns.participant'),
      key: 'employee',
      render: (_: unknown, record) => (
        <div className={styles.person}>
          <span>{record.fullName}</span>
          <span className={styles.personMeta}>
            {record.employeeCode}
            {record.departmentName ? ` · ${record.departmentName}` : ''}
          </span>
        </div>
      ),
    },
    {
      title: t('hr.trainings.columns.registrationDate'),
      dataIndex: 'registrationDate',
      width: 120,
      render: (value: string) => formatDate(value),
    },
    {
      title: t('hr.trainings.columns.result'),
      key: 'result',
      width: 160,
      render: (_: unknown, record) =>
        record.result === null ? (
          <span className={styles.muted}>{t('hr.trainings.notGraded')}</span>
        ) : (
          <Space size={4}>
            <Tag color={RESULT_COLORS[record.result]} bordered={false}>
              {t(`hr.trainings.result.${record.result}`)}
            </Tag>
            {record.score !== null && (
              <span className={styles.mono}>{record.score}</span>
            )}
          </Space>
        ),
    },
    ...(canWrite
      ? [
          {
            title: '',
            key: 'actions',
            width: 90,
            render: (_: unknown, record: TrainingParticipant) => (
              <Space size={0}>
                <Tooltip title={t('hr.trainings.grade')}>
                  <Button
                    size="small"
                    type="text"
                    icon={<TrophyOutlined />}
                    aria-label={t('hr.trainings.grade')}
                    onClick={() => setGrading(record)}
                  />
                </Tooltip>
                {/* Đã chấm kết quả thì backend không cho gỡ — không bày nút cụt. */}
                {record.result === null && (
                  <Popconfirm
                    title={t('hr.trainings.unenrollConfirm')}
                    okText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                    onConfirm={() => handleUnenroll(record)}
                  >
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      aria-label={t('hr.trainings.unenroll')}
                      loading={mutations.isUnenrolling}
                    />
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]
      : []),
  ];

  const rows = list.data ?? [];
  const isFull =
    training?.maxParticipants !== null &&
    training !== null &&
    rows.length >= (training.maxParticipants ?? Number.POSITIVE_INFINITY);

  return (
    <Drawer
      open={training !== null}
      onClose={onClose}
      title={training?.name}
      size="large"
      destroyOnHidden
    >
      {training && (
        <p className={styles.subtitle}>
          {training.code} · {t(`hr.trainings.type.${training.type}`)} ·{' '}
          {t('hr.trainings.participantCount', { n: rows.length })}
          {training.maxParticipants !== null
            ? ` / ${training.maxParticipants}`
            : ''}
        </p>
      )}

      {canWrite && (
        <Form
          form={form}
          layout="inline"
          className={styles.enrollRow}
          onFinish={handleEnroll}
        >
          <Form.Item
            name="employeeIds"
            className={styles.enrollField}
            rules={[
              { required: true, message: t('hr.trainings.errors.employees') },
            ]}
          >
            <EmployeeSelect
              mode="multiple"
              enabled={training !== null}
              placeholder={t('hr.trainings.enrollPlaceholder')}
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<UserAddOutlined />}
              loading={mutations.isEnrolling}
            >
              {t('hr.trainings.enroll')}
            </Button>
          </Form.Item>
        </Form>
      )}

      {/* Khoá đã đủ chỗ thì backend từ chối — nói trước để khỏi bấm rồi mới biết. */}
      {canWrite && isFull && (
        <Alert
          type="warning"
          showIcon
          title={t('hr.trainings.fullWarning')}
          className={styles.notice}
        />
      )}

      {error && (
        <Alert type="error" showIcon title={error} className={styles.notice} />
      )}

      {list.isLoading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : list.isError ? (
        <Alert
          type="error"
          showIcon
          title={resolveError(list.error) || t('hr.trainings.participantsError')}
          action={
            <Button size="small" onClick={() => void list.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('hr.trainings.participantsEmpty')}
        />
      ) : (
        <Table<TrainingParticipant>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={rows}
          pagination={false}
        />
      )}

      <CompleteParticipantModal
        trainingId={trainingId}
        participant={grading}
        onClose={() => setGrading(null)}
      />
    </Drawer>
  );
}
