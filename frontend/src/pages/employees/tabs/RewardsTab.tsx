import { useState } from 'react';
import {
  Alert,
  App,
  AutoComplete,
  Button,
  DatePicker,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  type TableProps,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import {
  useDisciplineRewardMutations,
  useDisciplineRewards,
} from '@/hooks/useHrProcess';
import {
  DISCIPLINE_REWARD_TYPES,
  type DisciplineReward,
  type DisciplineRewardType,
} from '@/types/hr-process.types';
import { formatDate } from '@/utils/format';
import styles from './tabs.module.css';

/**
 * Tab "Khen thưởng & Kỷ luật" trong hồ sơ nhân viên.
 *
 * Bản ghi không mang tiền — tiền thưởng thực trả nằm ở tab Lương.
 */
export interface RewardsTabProps {
  employeeId: number;
  canWrite: boolean;
  canDelete: boolean;
}

interface FormValues {
  type: DisciplineRewardType;
  category: string;
  title: string;
  description: string;
  decisionNumber?: string;
  dates: [Dayjs, Dayjs];
  note?: string;
}

/** Hình thức kỷ luật theo Điều 124 BLLĐ 2019, và các mức khen thưởng thường dùng. */
const CATEGORY_SUGGESTIONS: Record<DisciplineRewardType, string[]> = {
  discipline: ['Khiển trách', 'Kéo dài thời hạn nâng lương', 'Cách chức', 'Sa thải'],
  reward: ['Thưởng KPI', 'Thưởng sáng kiến', 'Giấy khen', 'Thưởng thâm niên'],
};

export function RewardsTab({
  employeeId,
  canWrite,
  canDelete,
}: RewardsTabProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();
  const [form] = Form.useForm<FormValues>();

  const [typeFilter, setTypeFilter] = useState<DisciplineRewardType | 'all'>(
    'all',
  );
  const [editing, setEditing] = useState<DisciplineReward | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = useDisciplineRewards(
    employeeId,
    typeFilter === 'all' ? undefined : typeFilter,
  );
  const mutations = useDisciplineRewardMutations(employeeId);

  const openForm = (record: DisciplineReward | null) => {
    setEditing(record);
    setError(null);
    setFormOpen(true);

    if (record) {
      form.setFieldsValue({
        type: record.type,
        category: record.category,
        title: record.title,
        description: record.description,
        decisionNumber: record.decisionNumber ?? undefined,
        dates: [dayjs(record.decisionDate), dayjs(record.effectiveDate)],
        note: record.note ?? undefined,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ type: 'reward', dates: [dayjs(), dayjs()] });
    }
  };

  const handleSubmit = (values: FormValues) => {
    void (async () => {
      setError(null);

      const payload = {
        type: values.type,
        category: values.category.trim(),
        title: values.title.trim(),
        description: values.description.trim(),
        decisionNumber: values.decisionNumber?.trim() || undefined,
        decisionDate: values.dates[0].format('YYYY-MM-DD'),
        effectiveDate: values.dates[1].format('YYYY-MM-DD'),
        note: values.note?.trim() || undefined,
      };

      try {
        if (editing) {
          await mutations.updateRecord({ recordId: editing.id, payload });
        } else {
          await mutations.createRecord(payload);
        }

        setFormOpen(false);
        message.success(
          t(editing ? 'hr.rewards.updateSuccess' : 'hr.rewards.createSuccess'),
        );
      } catch (submitError) {
        setError(resolveError(submitError));
      }
    })();
  };

  const runDelete = (record: DisciplineReward) => {
    void (async () => {
      try {
        await mutations.deleteRecord(record.id);
        message.success(t('hr.rewards.deleteSuccess'));
      } catch (deleteError) {
        message.error(resolveError(deleteError));
      }
    })();
  };

  const columns: TableProps<DisciplineReward>['columns'] = [
    {
      title: t('hr.rewards.columns.type'),
      dataIndex: 'type',
      width: 120,
      render: (value: DisciplineRewardType) => (
        <Tag color={value === 'reward' ? 'green' : 'red'} bordered={false}>
          {t(`hr.rewards.type.${value}`)}
        </Tag>
      ),
    },
    {
      title: t('hr.rewards.columns.title'),
      dataIndex: 'title',
      render: (value: string, record) => (
        <div className={styles.stackedCell}>
          <span>{value}</span>
          <span className={styles.cellMeta}>{record.category}</span>
        </div>
      ),
    },
    {
      title: t('hr.rewards.columns.decisionDate'),
      dataIndex: 'decisionDate',
      width: 120,
      render: (value: string) => formatDate(value),
    },
    {
      title: t('hr.rewards.columns.effectiveDate'),
      dataIndex: 'effectiveDate',
      width: 120,
      render: (value: string) => formatDate(value),
    },
    {
      title: t('hr.rewards.columns.decisionNumber'),
      dataIndex: 'decisionNumber',
      width: 150,
      render: (value: string | null) => value ?? '—',
    },
    {
      title: t('hr.rewards.columns.issuedBy'),
      dataIndex: ['issuedBy', 'fullName'],
      width: 160,
      render: (_: unknown, record) => record.issuedBy?.fullName ?? '—',
    },
    ...(canWrite || canDelete
      ? [
          {
            title: '',
            key: 'actions',
            width: 88,
            render: (_: unknown, record: DisciplineReward) => (
              <Space size={0}>
                {canWrite && (
                  <Button
                    size="small"
                    type="text"
                    icon={<EditOutlined />}
                    aria-label={t('common.edit')}
                    onClick={() => openForm(record)}
                  />
                )}
                {canDelete && (
                  <Popconfirm
                    title={t('hr.rewards.deleteConfirm')}
                    okText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                    onConfirm={() => runDelete(record)}
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
                )}
              </Space>
            ),
          },
        ]
      : []),
  ];

  if (list.isLoading) {
    return <Skeleton active paragraph={{ rows: 4 }} />;
  }

  if (list.isError) {
    return (
      <Alert
        type="error"
        showIcon
        title={resolveError(list.error) || t('hr.rewards.loadError')}
        action={
          <Button size="small" onClick={() => void list.refetch()}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  }

  const rows = list.data ?? [];

  return (
    <div className={styles.tab}>
      <div className={styles.toolbar}>
        <Segmented<DisciplineRewardType | 'all'>
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: 'all', label: t('common.all') },
            ...DISCIPLINE_REWARD_TYPES.map((value) => ({
              value,
              label: t(`hr.rewards.type.${value}`),
            })),
          ]}
        />

        <span className={styles.toolbarSpacer} />

        {canWrite && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openForm(null)}
          >
            {t('hr.rewards.create')}
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('hr.rewards.empty')}
        />
      ) : (
        <Table<DisciplineReward>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={rows}
          pagination={false}
          scroll={{ x: 900 }}
          expandable={{
            expandedRowRender: (record) => (
              <div className={styles.expanded}>
                <p>{record.description}</p>
                {record.note && (
                  <p className={styles.cellMeta}>{record.note}</p>
                )}
              </div>
            ),
          }}
        />
      )}

      <Modal
        open={isFormOpen}
        title={t(editing ? 'hr.rewards.edit' : 'hr.rewards.create')}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={mutations.isCreating || mutations.isUpdating}
        onOk={() => form.submit()}
        onCancel={() => setFormOpen(false)}
        destroyOnHidden
        width={620}
      >
        {error && (
          <Alert
            type="error"
            showIcon
            title={error}
            className={styles.formError}
          />
        )}

        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="type" label={t('hr.rewards.fields.type')}>
            <Select
              options={DISCIPLINE_REWARD_TYPES.map((value) => ({
                value,
                label: t(`hr.rewards.type.${value}`),
              }))}
            />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, next) => prev.type !== next.type}
          >
            {({ getFieldValue }) => (
              <Form.Item
                name="category"
                label={t('hr.rewards.fields.category')}
                rules={[
                  { required: true, message: t('hr.rewards.errors.category') },
                ]}
                extra={
                  getFieldValue('type') === 'discipline'
                    ? t('hr.rewards.disciplineFormsHint')
                    : undefined
                }
              >
                {/* Gõ tự do được: danh sách gợi ý không phủ hết mọi hình thức. */}
                <AutoComplete
                  options={CATEGORY_SUGGESTIONS[
                    (getFieldValue('type') as DisciplineRewardType) ?? 'reward'
                  ].map((value) => ({ value }))}
                  filterOption={(input, option) =>
                    String(option?.value ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            )}
          </Form.Item>

          <Form.Item
            name="title"
            label={t('hr.rewards.fields.title')}
            rules={[{ required: true, message: t('hr.rewards.errors.title') }]}
          >
            <Input maxLength={255} />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('hr.rewards.fields.description')}
            rules={[
              { required: true, message: t('hr.rewards.errors.description') },
            ]}
          >
            <Input.TextArea rows={3} maxLength={2000} showCount />
          </Form.Item>

          <Form.Item
            name="dates"
            label={t('hr.rewards.fields.dates')}
            extra={t('hr.rewards.datesHint')}
            rules={[{ required: true, message: t('hr.rewards.errors.dates') }]}
          >
            <DatePicker.RangePicker format="DD/MM/YYYY" className={styles.full} />
          </Form.Item>

          <Form.Item
            name="decisionNumber"
            label={t('hr.rewards.fields.decisionNumber')}
          >
            <Input maxLength={50} />
          </Form.Item>

          <Form.Item name="note" label={t('hr.rewards.fields.note')}>
            <Input.TextArea rows={2} maxLength={1000} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
