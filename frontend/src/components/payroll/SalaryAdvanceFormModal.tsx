import { useEffect, useState } from 'react';
import { Alert, App, DatePicker, Form, Input, InputNumber, Modal } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { EmployeeSelect } from '@/components/employees/EmployeeSelect';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useSalaryAdvanceMutations } from '@/hooks/usePayroll';
import styles from './SalaryAdvanceFormModal.module.css';

/**
 * Ghi nhận phiếu tạm ứng lương.
 *
 * HAI Ô NGÀY KHÁC NHAU, và đó là điểm dễ nhầm nhất của màn hình này:
 *
 *   - "Ngày ứng"  = ngày thực chi tiền cho nhân viên.
 *   - "Trừ vào kỳ" = kỳ lương sẽ bị trừ khoản này.
 *
 * Ứng ngày 28/07 để trừ vào lương tháng 8 là chuyện bình thường, nên mặc định
 * của ô thứ hai là THÁNG SAU chứ không phải tháng của ngày ứng. Đoán sai ở đây
 * nghĩa là trừ hai lần hoặc không trừ lần nào.
 *
 * KHÔNG PHẢI FORM TỰ ĐỀ NGHỊ. Nhân viên không đăng nhập hệ thống này; quản lý
 * ghi nhận cho phòng mình, nhân sự ghi cho bất kỳ ai.
 */
export interface SalaryAdvanceFormModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormValues {
  employeeId: number;
  amount: number;
  advanceDate: Dayjs;
  deductPeriod: Dayjs;
  reason: string;
}

export function SalaryAdvanceFormModal({
  open,
  onClose,
}: SalaryAdvanceFormModalProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();
  const [form] = Form.useForm<FormValues>();
  const { createAdvance, isCreating } = useSalaryAdvanceMutations();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      form.resetFields();
      form.setFieldsValue({
        advanceDate: dayjs(),
        // Mặc định trừ vào kỳ lương THÁNG SAU — ứng trong tháng này thì bảng
        // lương tháng này thường đã hoặc sắp chốt.
        deductPeriod: dayjs().add(1, 'month'),
      });
    }
  }, [open, form]);

  const handleSubmit = (values: FormValues) => {
    void (async () => {
      setError(null);

      try {
        await createAdvance({
          employeeId: values.employeeId,
          amount: values.amount,
          advanceDate: values.advanceDate.format('YYYY-MM-DD'),
          deductMonth: values.deductPeriod.month() + 1,
          deductYear: values.deductPeriod.year(),
          reason: values.reason.trim(),
        });
        onClose();
        message.success(t('payroll.advances.createSuccess'));
      } catch (submitError) {
        setError(resolveError(submitError));
      }
    })();
  };

  return (
    <Modal
      open={open}
      title={t('payroll.advances.create')}
      okText={t('payroll.advances.submit')}
      cancelText={t('common.cancel')}
      confirmLoading={isCreating}
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      {error && (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        disabled={isCreating}
      >
        <Form.Item
          name="employeeId"
          label={t('payroll.advances.fields.employee')}
          rules={[
            { required: true, message: t('payroll.advances.errors.employee') },
          ]}
        >
          <EmployeeSelect
            enabled={open}
            placeholder={t('payroll.advances.fields.employeePlaceholder')}
          />
        </Form.Item>

        <Form.Item
          name="amount"
          label={t('payroll.advances.fields.amount')}
          rules={[
            { required: true, message: t('payroll.advances.errors.amount') },
          ]}
        >
          <InputNumber<number>
            min={1}
            step={500000}
            className={styles.number}
            formatter={(value) =>
              value === undefined || value === null
                ? ''
                : `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
            }
            parser={(value) => Number((value ?? '').replace(/\D/g, '')) || 0}
          />
        </Form.Item>

        <div className={styles.dateRow}>
          <Form.Item
            name="advanceDate"
            label={t('payroll.advances.fields.advanceDate')}
            rules={[
              { required: true, message: t('payroll.advances.errors.advanceDate') },
            ]}
          >
            <DatePicker format="DD/MM/YYYY" className={styles.fullWidth} />
          </Form.Item>

          <Form.Item
            name="deductPeriod"
            label={t('payroll.advances.fields.deductPeriod')}
            rules={[
              {
                required: true,
                message: t('payroll.advances.errors.deductPeriod'),
              },
            ]}
          >
            <DatePicker
              picker="month"
              format="MM/YYYY"
              className={styles.fullWidth}
            />
          </Form.Item>
        </div>

        <p className={styles.hint}>{t('payroll.advances.deductHint')}</p>

        <Form.Item
          name="reason"
          label={t('payroll.advances.fields.reason')}
          rules={[
            { required: true, message: t('payroll.advances.errors.reason') },
            { min: 5, message: t('payroll.advances.errors.reasonTooShort') },
          ]}
        >
          <Input.TextArea rows={2} maxLength={255} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}
