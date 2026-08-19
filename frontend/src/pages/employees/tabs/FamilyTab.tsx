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
  Tooltip,
  type TableProps,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useFamilyMembers } from '@/hooks/useEmployees';
import {
  FAMILY_RELATIONSHIPS,
  type FamilyMember,
  type FamilyRelationship,
} from '@/types/employee.types';
import { formatDate, formatPhone, maskCccd } from '@/utils/format';
import { DependentsSection } from './DependentsSection';
import styles from './tabs.module.css';

/**
 * "Gia đình" tab — `family_members`, the HR record of who is in the household.
 *
 * The tab holds TWO tables, because HR fills them in together but they are not
 * the same record:
 *   - **Thành viên gia đình** (`family_members`) — an HR note about the
 *     household. No tax consequence.
 *   - **Người phụ thuộc** (`dependents`, rendered by `DependentsSection`) — the
 *     tax deduction register. Every active row lowers the employee's taxable
 *     income, so it carries registration dates, an end date and a reason when
 *     the deduction stops.
 * Merging them into one table would blur exactly the distinction that matters
 * at payroll time.
 *
 * CCCD is masked here for the same reason as on the personal tab — a family
 * member's ID number has no business being readable at a glance.
 */

export interface FamilyTabProps {
  employeeId: number;
  canWrite: boolean;
}

interface FamilyFormValues {
  fullName: string;
  relationship: FamilyRelationship;
  dateOfBirth?: Dayjs;
  occupation?: string;
  phone?: string;
  cccdNumber?: string;
  note?: string;
}

const PHONE_PATTERN = /^(0\d{9}|\+84\d{9})$/;
const CCCD_PATTERN = /^\d{12}$/;

export function FamilyTab({ employeeId, canWrite }: FamilyTabProps) {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const resolveError = useApiErrorMessage();

  const resource = useFamilyMembers(employeeId, employeeId > 0);
  const [form] = Form.useForm<FamilyFormValues>();
  const [editing, setEditing] = useState<FamilyMember | null>(null);
  const [isOpen, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const rows = resource.data ?? [];

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    form.resetFields();
    setOpen(true);
  };

  const openEdit = (row: FamilyMember) => {
    setEditing(row);
    setFormError(null);
    form.setFieldsValue({
      fullName: row.fullName,
      relationship: row.relationship,
      dateOfBirth: row.dateOfBirth ? dayjs(row.dateOfBirth) : undefined,
      occupation: row.occupation ?? undefined,
      phone: row.phone ?? undefined,
      cccdNumber: row.cccdNumber ?? undefined,
      note: row.note ?? undefined,
    });
    setOpen(true);
  };

  const handleSubmit = () => {
    void form.validateFields().then(async (values) => {
      setFormError(null);
      const payload = {
        fullName: values.fullName.trim(),
        relationship: values.relationship,
        dateOfBirth: values.dateOfBirth ? values.dateOfBirth.format('YYYY-MM-DD') : null,
        occupation: values.occupation?.trim() || null,
        phone: values.phone?.trim() || null,
        cccdNumber: values.cccdNumber?.trim() || null,
        note: values.note?.trim() || null,
      };

      try {
        if (editing) {
          await resource.updateMember(editing.id, payload);
        } else {
          await resource.createMember(payload);
        }
        setOpen(false);
        // Modal closed — a toast is the only surface left (§8).
        message.success(
          editing ? t('employees.family.updated') : t('employees.family.created'),
        );
      } catch (error) {
        setFormError(resolveError(error));
      }
    });
  };

  const handleDelete = (row: FamilyMember) => {
    modal.confirm({
      title: t('employees.family.deleteTitle'),
      content: t('crud.deleteContent', { name: row.fullName }),
      okText: t('crud.deleteOk'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      maskClosable: false,
      onOk: async () => {
        try {
          await resource.removeMember(row.id);
          message.success(t('employees.family.deleted'));
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

  const columns: TableProps<FamilyMember>['columns'] = [
    { title: t('employees.family.name'), dataIndex: 'fullName', key: 'fullName' },
    {
      title: t('employees.family.relationship'),
      dataIndex: 'relationship',
      key: 'relationship',
      render: (value: FamilyRelationship) => t(`employees.relationship.${value}`),
    },
    {
      title: t('employees.fields.dateOfBirth'),
      dataIndex: 'dateOfBirth',
      key: 'dateOfBirth',
      render: (value: string | null) =>
        value ? formatDate(value) : <span className={styles.muted}>—</span>,
    },
    {
      title: t('employees.family.occupation'),
      dataIndex: 'occupation',
      key: 'occupation',
      render: (value: string | null) => value ?? <span className={styles.muted}>—</span>,
    },
    {
      title: t('employees.fields.phone'),
      dataIndex: 'phone',
      key: 'phone',
      render: (value: string | null) =>
        value ? (
          <span className={styles.mono}>{formatPhone(value)}</span>
        ) : (
          <span className={styles.muted}>—</span>
        ),
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
    ...(canWrite
      ? [
          {
            title: t('employees.columns.actions'),
            key: 'actions',
            width: 110,
            render: (_: unknown, row: FamilyMember) => (
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
    return <Skeleton active paragraph={{ rows: 4 }} />;
  }

  if (resource.isError) {
    return (
      <Alert
        type="error"
        showIcon
        title={t('employees.family.loadError')}
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
      <p className={styles.sectionTitle}>{t('employees.family.sectionMembers')}</p>

      <div className={styles.toolbar}>
        <span className={styles.muted}>{t('crud.totalRecords', { total: rows.length })}</span>
        {canWrite && (
          <Button icon={<PlusOutlined />} onClick={openCreate}>
            {t('employees.family.add')}
          </Button>
        )}
      </div>

      <Table<FamilyMember>
        columns={columns}
        dataSource={rows}
        rowKey="id"
        size="middle"
        pagination={false}
        loading={resource.isFetching}
        locale={{ emptyText: <Empty description={t('employees.family.empty')} /> }}
        scroll={{ x: 800 }}
      />

      <p className={styles.sectionTitle}>{t('employees.family.sectionDependents')}</p>
      <p className={styles.sectionHint}>{t('employees.family.dependentsIntro')}</p>
      <DependentsSection employeeId={employeeId} canWrite={canWrite} />

      <Modal
        open={isOpen}
        title={editing ? t('employees.family.editTitle') : t('employees.family.add')}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={resource.isSaving}
        onOk={handleSubmit}
        onCancel={() => setOpen(false)}
        maskClosable={false}
      >
        <Form
          form={form}
          layout="vertical"
          disabled={resource.isSaving}
          initialValues={{ relationship: 'child' as FamilyRelationship }}
        >
          <Row gutter={16}>
            <Col xs={24} md={14}>
              <Form.Item
                name="fullName"
                label={t('employees.family.name')}
                rules={[{ required: true, message: t('employees.validation.required') }]}
              >
                <Input maxLength={100} />
              </Form.Item>
            </Col>
            <Col xs={24} md={10}>
              <Form.Item name="relationship" label={t('employees.family.relationship')}>
                <Select
                  options={FAMILY_RELATIONSHIPS.map((value) => ({
                    value,
                    label: t(`employees.relationship.${value}`),
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="dateOfBirth" label={t('employees.fields.dateOfBirth')}>
                <DatePicker format="DD/MM/YYYY" className={styles.full} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="occupation" label={t('employees.family.occupation')}>
                <Input maxLength={100} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="phone"
                label={t('employees.fields.phone')}
                rules={[{ pattern: PHONE_PATTERN, message: t('employees.validation.phone') }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="cccdNumber"
                label={t('employees.fields.cccdNumber')}
                rules={[{ pattern: CCCD_PATTERN, message: t('employees.validation.cccd') }]}
              >
                <Input maxLength={12} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="note" label={t('employees.fields.notes')}>
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        {formError && <Alert type="error" showIcon title={formError} />}
      </Modal>
    </div>
  );
}
