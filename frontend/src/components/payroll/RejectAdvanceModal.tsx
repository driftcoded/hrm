import { useEffect, useState } from 'react';
import { Alert, App, Form, Input, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useSalaryAdvanceMutations } from '@/hooks/usePayroll';
import type { SalaryAdvance } from '@/types/payroll.types';
import { formatCurrency } from '@/utils/format';

/**
 * Từ chối một phiếu tạm ứng.
 *
 * LÝ DO LÀ BẮT BUỘC, và đó là lý do đây là modal chứ không phải `Popconfirm` như
 * nút Duyệt. Từ chối mà không nói vì sao thì người ghi không biết sửa gì để nộp
 * lại, và người duyệt không phải chịu trách nhiệm về quyết định của mình. Duyệt
 * thì không cần lý do — nó là trạng thái mong đợi.
 */
export interface RejectAdvanceModalProps {
  /** `null` = đóng. */
  advance: SalaryAdvance | null;
  onClose: () => void;
}

export function RejectAdvanceModal({
  advance,
  onClose,
}: RejectAdvanceModalProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();
  const [form] = Form.useForm<{ reason: string }>();
  const { rejectAdvance, isRejecting } = useSalaryAdvanceMutations();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (advance) {
      setError(null);
      form.resetFields();
    }
  }, [advance, form]);

  const handleSubmit = (values: { reason: string }) => {
    if (!advance) {
      return;
    }

    void (async () => {
      setError(null);

      try {
        await rejectAdvance({ id: advance.id, reason: values.reason.trim() });
        onClose();
        message.success(t('payroll.advances.rejectSuccess'));
      } catch (submitError) {
        setError(resolveError(submitError));
      }
    })();
  };

  return (
    <Modal
      open={advance !== null}
      title={t('payroll.advances.rejectTitle')}
      okText={t('payroll.advances.reject')}
      okButtonProps={{ danger: true }}
      cancelText={t('common.cancel')}
      confirmLoading={isRejecting}
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      {error && (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
      )}

      {advance && (
        <p>
          {t('payroll.advances.rejectSubject', {
            name: advance.employee.fullName,
            amount: formatCurrency(advance.amount),
          })}
        </p>
      )}

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="reason"
          label={t('payroll.advances.fields.rejectReason')}
          rules={[
            {
              required: true,
              message: t('payroll.advances.errors.rejectReason'),
            },
            { min: 5, message: t('payroll.advances.errors.reasonTooShort') },
          ]}
        >
          <Input.TextArea rows={3} maxLength={500} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}
