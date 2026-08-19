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
  InputNumber,
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
import { DeleteOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useContracts } from '@/hooks/useEmployees';
import {
  CONTRACT_TYPES,
  type Contract,
  type ContractStatus,
  type ContractTypeValue,
} from '@/types/employee.types';
import { formatCurrency, formatDate } from '@/utils/format';
import styles from './tabs.module.css';

/**
 * "Hợp đồng" tab — every labour contract this employee has signed.
 *
 * Three actions, and the difference between them is the point:
 *   - **Thêm** creates a new contract.
 *   - **Chấm dứt** ends a SIGNED one. It is not an edit: the server writes
 *     status, date and reason together, because a signed contract is a legal
 *     record you end, not one you quietly rewrite.
 *   - **Xoá** only ever appears on a `draft`. The `contracts` table has no
 *     soft-delete column, so deleting is permanent, and the server refuses it
 *     for anything already signed.
 *
 * The business rules (indefinite ⇒ no end date, fixed-term ≤ 36 months and at
 * most twice, one active contract per person) are enforced by the server. The
 * form mirrors the first of them so the user is not offered a field that is
 * guaranteed to be rejected; the rest surface as inline errors.
 */

const STATUS_COLORS: Record<ContractStatus, string> = {
  draft: 'default',
  active: 'green',
  expired: 'orange',
  terminated: 'red',
};

export interface ContractsTabProps {
  employeeId: number;
  canWrite: boolean;
}

interface ContractFormValues {
  contractNumber: string;
  contractType: ContractTypeValue;
  signDate: Dayjs;
  startDate: Dayjs;
  endDate?: Dayjs;
  baseSalary: number;
  insuranceSalary: number;
  positionAllowance?: number;
  otherAllowance?: number;
  status: 'draft' | 'active';
  note?: string;
}

interface TerminateFormValues {
  terminatedDate: Dayjs;
  terminatedReason: string;
}

export function ContractsTab({ employeeId, canWrite }: ContractsTabProps) {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const resolveError = useApiErrorMessage();

  const resource = useContracts({ employeeId, limit: 50 }, employeeId > 0);
  const [form] = Form.useForm<ContractFormValues>();
  const [terminateForm] = Form.useForm<TerminateFormValues>();

  const [isCreateOpen, setCreateOpen] = useState(false);
  const [terminating, setTerminating] = useState<Contract | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const contractType = Form.useWatch('contractType', form);
  const rows = resource.data?.items ?? [];

  const handleCreate = () => {
    void form.validateFields().then(async (values) => {
      setFormError(null);
      try {
        await resource.createContract({
          employeeId,
          contractNumber: values.contractNumber.trim(),
          contractType: values.contractType,
          signDate: values.signDate.format('YYYY-MM-DD'),
          startDate: values.startDate.format('YYYY-MM-DD'),
          endDate: values.endDate ? values.endDate.format('YYYY-MM-DD') : null,
          baseSalary: values.baseSalary,
          insuranceSalary: values.insuranceSalary,
          positionAllowance: values.positionAllowance ?? 0,
          otherAllowance: values.otherAllowance ?? 0,
          status: values.status,
          note: values.note?.trim() || null,
        });
        setCreateOpen(false);
        form.resetFields();
        message.success(t('employees.contracts.created'));
      } catch (error) {
        setFormError(resolveError(error));
      }
    });
  };

  const handleTerminate = () => {
    if (!terminating) {
      return;
    }
    void terminateForm.validateFields().then(async (values) => {
      setFormError(null);
      try {
        await resource.terminateContract(terminating.id, {
          terminatedDate: values.terminatedDate.format('YYYY-MM-DD'),
          terminatedReason: values.terminatedReason.trim(),
        });
        setTerminating(null);
        terminateForm.resetFields();
        message.success(t('employees.contracts.terminated'));
      } catch (error) {
        setFormError(resolveError(error));
      }
    });
  };

  const handleDelete = (contract: Contract) => {
    modal.confirm({
      title: t('employees.contracts.deleteTitle'),
      content: t('employees.contracts.deleteBody', { number: contract.contractNumber }),
      okText: t('crud.deleteOk'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      maskClosable: false,
      onOk: async () => {
        try {
          await resource.removeContract(contract.id);
          message.success(t('employees.contracts.deleted'));
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

  const columns: TableProps<Contract>['columns'] = [
    {
      title: t('employees.contracts.number'),
      dataIndex: 'contractNumber',
      key: 'contractNumber',
      render: (value: string) => <span className={styles.mono}>{value}</span>,
    },
    {
      title: t('employees.fields.contractType'),
      dataIndex: 'contractType',
      key: 'contractType',
      render: (value: ContractTypeValue) => t(`employees.contractType.${value}`),
    },
    {
      title: t('employees.contracts.period'),
      key: 'period',
      render: (_: unknown, row) =>
        `${formatDate(row.startDate)} → ${
          row.endDate ? formatDate(row.endDate) : t('employees.contracts.noEnd')
        }`,
    },
    {
      title: t('employees.fields.baseSalary'),
      dataIndex: 'baseSalary',
      key: 'baseSalary',
      align: 'right',
      render: (value: number) => formatCurrency(value),
    },
    {
      title: t('employees.columns.status'),
      dataIndex: 'status',
      key: 'status',
      render: (value: ContractStatus) => (
        <Tag color={STATUS_COLORS[value]} bordered={false}>
          {t(`employees.contractStatus.${value}`)}
        </Tag>
      ),
    },
    ...(canWrite
      ? [
          {
            title: t('employees.columns.actions'),
            key: 'actions',
            width: 110,
            render: (_: unknown, row: Contract) => (
              <Space size="small">
                {row.status === 'active' && (
                  <Tooltip title={t('employees.contracts.terminate')}>
                    <Button
                      type="text"
                      size="small"
                      icon={<StopOutlined />}
                      onClick={() => {
                        setFormError(null);
                        terminateForm.setFieldsValue({ terminatedDate: dayjs() });
                        setTerminating(row);
                      }}
                      aria-label={t('employees.contracts.terminateAria', {
                        number: row.contractNumber,
                      })}
                    />
                  </Tooltip>
                )}
                {row.status === 'draft' && (
                  <Tooltip title={t('common.delete')}>
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleDelete(row)}
                      aria-label={t('crud.deleteRecordAria', { name: row.contractNumber })}
                    />
                  </Tooltip>
                )}
              </Space>
            ),
          },
        ]
      : []),
  ];

  if (resource.isLoading) {
    return <Skeleton active paragraph={{ rows: 5 }} />;
  }

  if (resource.isError) {
    return (
      <Alert
        type="error"
        showIcon
        message={t('employees.contracts.loadError')}
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
        <span className={styles.muted}>{t('crud.totalRecords', { total: rows.length })}</span>
        {canWrite && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setFormError(null);
              form.resetFields();
              setCreateOpen(true);
            }}
          >
            {t('employees.contracts.add')}
          </Button>
        )}
      </div>

      <Table<Contract>
        columns={columns}
        dataSource={rows}
        rowKey="id"
        size="middle"
        pagination={false}
        loading={resource.isFetching}
        locale={{ emptyText: <Empty description={t('employees.contracts.empty')} /> }}
        scroll={{ x: 800 }}
      />

      {/* ------------------------------------------------ create modal --- */}
      <Modal
        open={isCreateOpen}
        title={t('employees.contracts.add')}
        width={720}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={resource.isSaving}
        onOk={handleCreate}
        onCancel={() => setCreateOpen(false)}
        maskClosable={false}
      >
        <Form
          form={form}
          layout="vertical"
          disabled={resource.isSaving}
          initialValues={{
            contractType: 'probation' as ContractTypeValue,
            status: 'draft' as const,
            positionAllowance: 0,
            otherAllowance: 0,
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="contractNumber"
                label={t('employees.fields.contractNumber')}
                rules={[{ required: true, message: t('employees.validation.required') }]}
              >
                <Input placeholder="HDLD-2026-001" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="contractType" label={t('employees.fields.contractType')}>
                <Select
                  options={CONTRACT_TYPES.map((value) => ({
                    value,
                    label: t(`employees.contractType.${value}`),
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="signDate"
                label={t('employees.fields.signDate')}
                rules={[{ required: true, message: t('employees.validation.required') }]}
              >
                <DatePicker format="DD/MM/YYYY" className={styles.full} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="startDate"
                label={t('employees.fields.contractStart')}
                rules={[{ required: true, message: t('employees.validation.required') }]}
              >
                <DatePicker format="DD/MM/YYYY" className={styles.full} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="endDate"
                label={t('employees.fields.contractEnd')}
                rules={[
                  {
                    required: contractType !== 'indefinite',
                    message: t('employees.validation.required'),
                  },
                ]}
                extra={
                  contractType === 'indefinite'
                    ? t('employees.validation.indefiniteNoEnd')
                    : undefined
                }
              >
                <DatePicker
                  format="DD/MM/YYYY"
                  className={styles.full}
                  disabled={contractType === 'indefinite'}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="baseSalary"
                label={t('employees.fields.baseSalary')}
                rules={[{ required: true, message: t('employees.validation.required') }]}
              >
                <InputNumber min={0} step={1000000} className={styles.full} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="insuranceSalary"
                label={t('employees.fields.insuranceSalary')}
                rules={[{ required: true, message: t('employees.validation.required') }]}
              >
                <InputNumber min={0} step={1000000} className={styles.full} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="positionAllowance" label={t('employees.fields.positionAllowance')}>
                <InputNumber min={0} step={100000} className={styles.full} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="otherAllowance" label={t('employees.fields.otherAllowance')}>
                <InputNumber min={0} step={100000} className={styles.full} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="status"
                label={t('employees.columns.status')}
                extra={t('employees.contracts.statusHint')}
              >
                <Select
                  options={(['draft', 'active'] as const).map((value) => ({
                    value,
                    label: t(`employees.contractStatus.${value}`),
                  }))}
                />
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

      {/* --------------------------------------------- terminate modal --- */}
      <Modal
        open={terminating !== null}
        title={t('employees.contracts.terminate')}
        okText={t('employees.contracts.terminateConfirm')}
        okButtonProps={{ danger: true }}
        cancelText={t('common.cancel')}
        confirmLoading={resource.isSaving}
        onOk={handleTerminate}
        onCancel={() => setTerminating(null)}
        maskClosable={false}
      >
        <p>
          {t('employees.contracts.terminateBody', {
            number: terminating?.contractNumber ?? '',
          })}
        </p>
        <Form form={terminateForm} layout="vertical" disabled={resource.isSaving}>
          <Form.Item
            name="terminatedDate"
            label={t('employees.contracts.terminatedDate')}
            rules={[{ required: true, message: t('employees.validation.required') }]}
          >
            <DatePicker format="DD/MM/YYYY" className={styles.full} />
          </Form.Item>
          <Form.Item
            name="terminatedReason"
            label={t('employees.contracts.terminatedReason')}
            rules={[{ required: true, message: t('employees.validation.required') }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>

        {formError && <Alert type="error" showIcon message={formError} />}
      </Modal>
    </div>
  );
}
