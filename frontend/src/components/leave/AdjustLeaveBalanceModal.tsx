import { useEffect, useState } from 'react';
import { Alert, App, Form, Input, InputNumber, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useLeaveBalanceMutations } from '@/hooks/useLeave';
import type { LeaveBalance } from '@/types/leave.types';
import styles from './AdjustLeaveBalanceModal.module.css';

/**
 * Nhân sự điều chỉnh quỹ phép của một người.
 *
 * CHỈ SỬA ĐƯỢC HAI Ô: số ngày được cấp và số ngày chuyển từ năm trước.
 * `usedDays`/`pendingDays` là HỆ QUẢ của các đơn nghỉ — cho sửa tay sẽ làm quỹ
 * lệch khỏi danh sách đơn và không ai biết bên nào đúng. Sai ở đâu thì sửa đơn
 * ở đó. Hai con số đó vẫn được HIỆN, ở dạng chỉ đọc, để người sửa thấy mình
 * đang không được hạ xuống dưới mức nào.
 *
 * LÝ DO LÀ BẮT BUỘC: quỹ phép là quyền lợi của người lao động, mọi thay đổi
 * thủ công phải nói được vì sao.
 */
export interface AdjustLeaveBalanceModalProps {
  /** `null` = đóng. */
  balance: LeaveBalance | null;
  onClose: () => void;
}

interface FormValues {
  allocatedDays: number;
  carriedOver: number;
  reason: string;
}

export function AdjustLeaveBalanceModal({
  balance,
  onClose,
}: AdjustLeaveBalanceModalProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();
  const [form] = Form.useForm<FormValues>();
  const { adjustBalance, isAdjusting } = useLeaveBalanceMutations();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!balance) {
      return;
    }

    setError(null);
    form.setFieldsValue({
      allocatedDays: balance.allocatedDays,
      carriedOver: balance.carriedOver,
      reason: '',
    });
  }, [balance, form]);

  const committed = balance
    ? balance.usedDays + balance.pendingDays
    : 0;

  const handleSubmit = (values: FormValues) => {
    if (!balance) {
      return;
    }

    void (async () => {
      setError(null);
      try {
        await adjustBalance({
          id: balance.id,
          payload: {
            allocatedDays: values.allocatedDays,
            carriedOver: values.carriedOver,
            reason: values.reason.trim(),
          },
        });
        onClose();
        message.success(t('leave.balances.adjustSuccess'));
      } catch (submitError) {
        setError(resolveError(submitError));
      }
    })();
  };

  return (
    <Modal
      open={Boolean(balance)}
      title={
        balance
          ? t('leave.balances.adjustTitle', {
              name: balance.employee?.fullName ?? '',
              year: balance.year,
            })
          : ''
      }
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      confirmLoading={isAdjusting}
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      {error && (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
      )}

      <Form form={form} layout="vertical" onFinish={handleSubmit} disabled={isAdjusting}>
        <div className={styles.numberRow}>
          <Form.Item
            name="allocatedDays"
            label={t('leave.balances.columns.allocated')}
            rules={[{ required: true, message: t('leave.balances.errors.allocated') }]}
          >
            <InputNumber min={0} max={365} step={0.5} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="carriedOver"
            label={t('leave.balances.columns.carriedOver')}
            rules={[{ required: true, message: t('leave.balances.errors.carriedOver') }]}
          >
            <InputNumber min={0} max={365} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
        </div>

        {/*
          Hai con số chỉ đọc, nhưng phải hiện: chúng là ngưỡng sàn mà backend
          dùng để từ chối (`LEAVE_BALANCE_BELOW_COMMITTED`).
        */}
        <p className={styles.committed}>
          {t('leave.balances.committedHint', {
            used: balance?.usedDays ?? 0,
            pending: balance?.pendingDays ?? 0,
            total: committed,
          })}
        </p>

        <Form.Item
          name="reason"
          label={t('leave.balances.adjustReason')}
          extra={t('leave.balances.adjustReasonHint')}
          rules={[
            { required: true, message: t('leave.balances.errors.reason') },
            { min: 5, message: t('leave.requests.reasonTooShort') },
          ]}
        >
          <Input.TextArea rows={3} maxLength={500} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}
