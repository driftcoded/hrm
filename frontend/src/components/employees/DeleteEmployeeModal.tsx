import { useEffect } from 'react';
import { Alert, DatePicker, Form, Input, Modal, Select } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { TERMINATION_TYPES, type TerminationType } from '@/types/employee.types';

/**
 * "Xoá nhân viên + lý do" (PLAN §3.2).
 *
 * A plain `Modal.confirm` will not do here, because the reason has to go
 * SOMEWHERE. `DELETE /employees/:id` takes no body, so the reason is written
 * first, through `PATCH /employees/:id`, into the three columns the schema
 * already has for it — `termination_reason`, `termination_type`,
 * `termination_date` (database-schema.md §2.3) — and only then is the record
 * soft-deleted. Asking for a reason and dropping it on the floor would be worse
 * than not asking.
 *
 * The caller performs both calls (see `EmployeesPage.handleDelete`) so that a
 * failed PATCH aborts the delete: a record must never end up deleted with no
 * recorded reason.
 *
 * Destructive, so: `maskClosable` is off (a stray backdrop click must not
 * confirm), the OK button is `danger`, and the copy says the record can be
 * restored — which is true, it is a soft delete.
 */

export interface DeleteEmployeeValues {
  reason: string;
  terminationType?: TerminationType;
  /** `YYYY-MM-DD`. */
  terminationDate: string;
}

export interface DeleteEmployeeModalProps {
  open: boolean;
  /** Shown in the confirmation sentence. */
  employeeName: string;
  isDeleting: boolean;
  /** Inline error from the failed request; `null` when there is none. */
  error: string | null;
  onCancel: () => void;
  onConfirm: (values: DeleteEmployeeValues) => void;
}

interface FormValues {
  reason: string;
  terminationType?: TerminationType;
  terminationDate: dayjs.Dayjs;
}

export function DeleteEmployeeModal({
  open,
  employeeName,
  isDeleting,
  error,
  onCancel,
  onConfirm,
}: DeleteEmployeeModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<FormValues>();

  // Reset on every opening: the previous employee's reason must not be
  // pre-filled for the next one.
  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        reason: '',
        terminationType: undefined,
        terminationDate: dayjs(),
      });
    }
  }, [form, open]);

  const handleOk = () => {
    void form.validateFields().then((values) => {
      onConfirm({
        reason: values.reason.trim(),
        terminationType: values.terminationType,
        terminationDate: values.terminationDate.format('YYYY-MM-DD'),
      });
    });
  };

  return (
    <Modal
      open={open}
      title={t('employees.delete.title')}
      okText={t('employees.delete.confirm')}
      okButtonProps={{ danger: true, loading: isDeleting }}
      cancelText={t('common.cancel')}
      onOk={handleOk}
      onCancel={onCancel}
      maskClosable={false}
      destroyOnHidden
    >
      <p>{t('employees.delete.body', { name: employeeName })}</p>

      <Form form={form} layout="vertical" requiredMark={false} disabled={isDeleting}>
        <Form.Item
          name="reason"
          label={t('employees.delete.reasonLabel')}
          rules={[
            { required: true, message: t('employees.delete.reasonRequired') },
            { min: 3, message: t('employees.delete.reasonRequired') },
          ]}
        >
          <Input.TextArea rows={3} placeholder={t('employees.delete.reasonPlaceholder')} />
        </Form.Item>

        <Form.Item name="terminationType" label={t('employees.fields.terminationType')}>
          <Select
            allowClear
            placeholder={t('employees.delete.terminationTypePlaceholder')}
            options={TERMINATION_TYPES.map((value) => ({
              value,
              label: t(`employees.terminationType.${value}`),
            }))}
          />
        </Form.Item>

        <Form.Item
          name="terminationDate"
          label={t('employees.fields.terminationDate')}
          rules={[{ required: true, message: t('employees.delete.dateRequired') }]}
        >
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
        </Form.Item>
      </Form>

      {/* Inline, in the still-open modal — no toast for the same event (§8). */}
      {error && <Alert type="error" showIcon message={error} />}
    </Modal>
  );
}
