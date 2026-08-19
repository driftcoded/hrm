import { useState } from 'react';
import {
  Alert,
  App,
  Button,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  type TableProps,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useDependents } from '@/hooks/useEmployees';
import {
  DEPENDENT_RELATIONSHIPS,
  type Dependent,
  type DependentRelationship,
} from '@/types/employee.types';
import { formatDate, maskCccd } from '@/utils/format';
import styles from './tabs.module.css';

/**
 * "Người phụ thuộc" — the family-circumstance tax deduction register
 * (Article 19, Personal Income Tax Law).
 *
 * Lives beside the family-member table on the same tab, because the two are
 * about the same people and HR fills them in together — but they are separate
 * records with different rules, and this one has money attached: every active
 * dependent lowers the employee's taxable income by 6.2M ₫/month. The heading
 * and the `isCurrentlyDeductible` column exist so nobody mistakes one list for
 * the other.
 *
 * STOPPING a deduction is not deleting it. "Ngừng giảm trừ" sets the record
 * inactive with a reason and keeps the history the tax office may ask about;
 * "Xoá" is permanent (no soft-delete column on this table) and is meant for a
 * row entered by mistake. Both are offered, worded differently on purpose.
 */

export interface DependentsSectionProps {
  employeeId: number;
  canWrite: boolean;
}

interface DependentFormValues {
  fullName: string;
  relationship: DependentRelationship;
  dateOfBirth: Dayjs;
  registrationDate: Dayjs;
  endDate?: Dayjs;
  cccdNumber?: string;
  taxCode?: string;
  note?: string;
}

interface StopFormValues {
  reasonInactive: string;
  endDate?: Dayjs;
}

const CCCD_PATTERN = /^\d{12}$/;
const TAX_CODE_PATTERN = /^\d{10}(-\d{3})?$/;

export function DependentsSection({ employeeId, canWrite }: DependentsSectionProps) {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const resolveError = useApiErrorMessage();

  const resource = useDependents(employeeId, employeeId > 0);
  const [form] = Form.useForm<DependentFormValues>();
  const [stopForm] = Form.useForm<StopFormValues>();

  const [editing, setEditing] = useState<Dependent | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [stopping, setStopping] = useState<Dependent | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const rows = resource.data ?? [];
  const activeCount = rows.filter((row) => row.isCurrentlyDeductible).length;

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    form.resetFields();
    setFormOpen(true);
  };

  const openEdit = (row: Dependent) => {
    setEditing(row);
    setFormError(null);
    form.setFieldsValue({
      fullName: row.fullName,
      relationship: row.relationship,
      dateOfBirth: dayjs(row.dateOfBirth),
      registrationDate: dayjs(row.registrationDate),
      endDate: row.endDate ? dayjs(row.endDate) : undefined,
      cccdNumber: row.cccdNumber ?? undefined,
      taxCode: row.taxCode ?? undefined,
      note: row.note ?? undefined,
    });
    setFormOpen(true);
  };

  const handleSubmit = () => {
    void form.validateFields().then(async (values) => {
      setFormError(null);
      const payload = {
        fullName: values.fullName.trim(),
        relationship: values.relationship,
        dateOfBirth: values.dateOfBirth.format('YYYY-MM-DD'),
        registrationDate: values.registrationDate.format('YYYY-MM-DD'),
        endDate: values.endDate ? values.endDate.format('YYYY-MM-DD') : null,
        cccdNumber: values.cccdNumber?.trim() || null,
        taxCode: values.taxCode?.trim() || null,
        note: values.note?.trim() || null,
      };

      try {
        if (editing) {
          await resource.updateDependent(editing.id, payload);
        } else {
          await resource.createDependent(payload);
        }
        setFormOpen(false);
        message.success(
          editing ? t('employees.dependents.updated') : t('employees.dependents.created'),
        );
      } catch (error) {
        setFormError(resolveError(error));
      }
    });
  };

  const handleStop = () => {
    if (!stopping) {
      return;
    }
    void stopForm.validateFields().then(async (values) => {
      setFormError(null);
      try {
        await resource.updateDependent(stopping.id, {
          status: 'inactive',
          reasonInactive: values.reasonInactive.trim(),
          ...(values.endDate ? { endDate: values.endDate.format('YYYY-MM-DD') } : {}),
        });
        setStopping(null);
        message.success(t('employees.dependents.stopped'));
      } catch (error) {
        setFormError(resolveError(error));
      }
    });
  };

  const handleDelete = (row: Dependent) => {
    modal.confirm({
      title: t('employees.dependents.deleteTitle'),
      content: t('employees.dependents.deleteBody', { name: row.fullName }),
      okText: t('crud.deleteOk'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      maskClosable: false,
      onOk: async () => {
        try {
          await resource.removeDependent(row.id);
          message.success(t('employees.dependents.deleted'));
        } catch (error) {
          modal.error({
            title: t('crud.deleteBlockedTitle'),
            content: resolveError(error),
            okText: t('crud.understood'),
          });
        }
      },
    });
  };

  const columns: TableProps<Dependent>['columns'] = [
    { title: t('employees.dependents.name'), dataIndex: 'fullName', key: 'fullName' },
    {
      title: t('employees.family.relationship'),
      dataIndex: 'relationship',
      key: 'relationship',
      render: (value: DependentRelationship) => t(`employees.dependentRelationship.${value}`),
    },
    {
      title: t('employees.fields.dateOfBirth'),
      dataIndex: 'dateOfBirth',
      key: 'dateOfBirth',
      render: (value: string) => formatDate(value),
    },
    {
      title: t('employees.dependents.period'),
      key: 'period',
      render: (_: unknown, row) =>
        `${formatDate(row.registrationDate)} → ${
          row.endDate ? formatDate(row.endDate) : t('employees.dependents.ongoing')
        }`,
    },
    {
      title: t('employees.fields.cccdNumber'),
      dataIndex: 'cccdNumber',
      key: 'cccdNumber',
      render: (value: string | null) =>
        value ? (
          <span className={styles.mono}>{maskCccd(value)}</span>
        ) : (
          <span className={styles.muted}>—</span>
        ),
    },
    {
      title: t('employees.dependents.deductible'),
      key: 'deductible',
      render: (_: unknown, row) =>
        row.isCurrentlyDeductible ? (
          <Tag color="green" bordered={false}>
            {t('employees.dependents.deductibleYes')}
          </Tag>
        ) : (
          <Tooltip title={row.reasonInactive ?? t('employees.dependents.notDeductibleHint')}>
            <Tag color="default" bordered={false}>
              {t('employees.dependents.deductibleNo')}
            </Tag>
          </Tooltip>
        ),
    },
    ...(canWrite
      ? [
          {
            title: t('employees.columns.actions'),
            key: 'actions',
            width: 140,
            render: (_: unknown, row: Dependent) => (
              <Space size="small">
                <Tooltip title={t('common.edit')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => openEdit(row)}
                    aria-label={t('crud.editRecordAria', { name: row.fullName })}
                  />
                </Tooltip>
                {row.status === 'active' && (
                  <Tooltip title={t('employees.dependents.stop')}>
                    <Button
                      type="text"
                      size="small"
                      icon={<StopOutlined />}
                      onClick={() => {
                        setFormError(null);
                        stopForm.setFieldsValue({ reasonInactive: '', endDate: dayjs() });
                        setStopping(row);
                      }}
                      aria-label={t('employees.dependents.stopAria', { name: row.fullName })}
                    />
                  </Tooltip>
                )}
                <Tooltip title={t('common.delete')}>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(row)}
                    aria-label={t('crud.deleteRecordAria', { name: row.fullName })}
                  />
                </Tooltip>
              </Space>
            ),
          },
        ]
      : []),
  ];

  if (resource.isLoading) {
    return <Skeleton active paragraph={{ rows: 3 }} />;
  }

  if (resource.isError) {
    return (
      <Alert
        type="error"
        showIcon
        message={t('employees.dependents.loadError')}
        action={
          <Button size="small" onClick={resource.refetch}>
            {t('common.retry')}
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <span className={styles.muted}>
          {t('employees.dependents.activeCount', { count: activeCount })}
        </span>
        {canWrite && (
          <Button icon={<PlusOutlined />} onClick={openCreate}>
            {t('employees.dependents.add')}
          </Button>
        )}
      </div>

      <Table<Dependent>
        columns={columns}
        dataSource={rows}
        rowKey="id"
        size="middle"
        pagination={false}
        loading={resource.isFetching}
        locale={{ emptyText: <Empty description={t('employees.dependents.empty')} /> }}
        scroll={{ x: 900 }}
      />

      {/* ------------------------------------------- create / edit modal --- */}
      <Modal
        open={isFormOpen}
        title={editing ? t('employees.dependents.editTitle') : t('employees.dependents.add')}
        width={680}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={resource.isSaving}
        onOk={handleSubmit}
        onCancel={() => setFormOpen(false)}
        maskClosable={false}
      >
        <Form
          form={form}
          layout="vertical"
          disabled={resource.isSaving}
          initialValues={{ relationship: 'child' as DependentRelationship }}
        >
          <Row gutter={16}>
            <Col xs={24} md={14}>
              <Form.Item
                name="fullName"
                label={t('employees.dependents.name')}
                rules={[{ required: true, message: t('employees.validation.required') }]}
              >
                <Input maxLength={100} />
              </Form.Item>
            </Col>
            <Col xs={24} md={10}>
              <Form.Item name="relationship" label={t('employees.family.relationship')}>
                <Select
                  options={DEPENDENT_RELATIONSHIPS.map((value) => ({
                    value,
                    label: t(`employees.dependentRelationship.${value}`),
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="dateOfBirth"
                label={t('employees.fields.dateOfBirth')}
                rules={[{ required: true, message: t('employees.validation.required') }]}
              >
                <DatePicker format="DD/MM/YYYY" className={styles.full} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="registrationDate"
                label={t('employees.dependents.registrationDate')}
                rules={[{ required: true, message: t('employees.validation.required') }]}
                extra={t('employees.dependents.registrationHint')}
              >
                <DatePicker format="DD/MM/YYYY" className={styles.full} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="endDate" label={t('employees.dependents.endDate')}>
                <DatePicker format="DD/MM/YYYY" className={styles.full} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="cccdNumber"
                label={t('employees.fields.cccdNumber')}
                rules={[{ pattern: CCCD_PATTERN, message: t('employees.validation.cccd') }]}
                extra={t('employees.dependents.identityHint')}
              >
                <Input maxLength={12} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="taxCode"
                label={t('employees.fields.taxCode')}
                rules={[{ pattern: TAX_CODE_PATTERN, message: t('employees.validation.taxCode') }]}
              >
                <Input maxLength={13} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="note" label={t('employees.fields.notes')}>
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        {formError && <Alert type="error" showIcon message={formError} />}
      </Modal>

      {/* ---------------------------------------------- stop deduction --- */}
      <Modal
        open={stopping !== null}
        title={t('employees.dependents.stop')}
        okText={t('employees.dependents.stopConfirm')}
        okButtonProps={{ danger: true }}
        cancelText={t('common.cancel')}
        confirmLoading={resource.isSaving}
        onOk={handleStop}
        onCancel={() => setStopping(null)}
        maskClosable={false}
      >
        <p>{t('employees.dependents.stopBody', { name: stopping?.fullName ?? '' })}</p>
        <Form form={stopForm} layout="vertical" disabled={resource.isSaving}>
          <Form.Item
            name="reasonInactive"
            label={t('employees.dependents.stopReason')}
            rules={[{ required: true, message: t('employees.validation.required') }]}
          >
            <Input.TextArea rows={3} placeholder={t('employees.dependents.stopReasonHint')} />
          </Form.Item>
          <Form.Item name="endDate" label={t('employees.dependents.endDate')}>
            <DatePicker format="DD/MM/YYYY" className={styles.full} />
          </Form.Item>
        </Form>

        {formError && <Alert type="error" showIcon message={formError} />}
      </Modal>
    </div>
  );
}
