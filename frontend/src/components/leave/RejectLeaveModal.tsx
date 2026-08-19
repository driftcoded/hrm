import { useEffect, useState } from 'react';
import { Alert, App, Form, Input, Modal } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useLeaveRequestMutations } from '@/hooks/useLeave';
import type { LeaveRequest } from '@/types/leave.types';

/**
 * Từ chối một đơn nghỉ phép.
 *
 * LÝ DO LÀ BẮT BUỘC, và đó là lý do đây là một modal thay vì một `Popconfirm`
 * như nút Duyệt. Từ chối mà không nói vì sao thì người ghi nhận không biết sửa
 * gì để nộp lại, và người duyệt không phải chịu trách nhiệm về quyết định của
 * mình. Duyệt thì không cần lý do — nó là trạng thái mong đợi.
 */
export interface RejectLeaveModalProps {
  /** `null` = đóng. */
  request: LeaveRequest | null;
  onClose: () => void;
}

export function RejectLeaveModal({ request, onClose }: RejectLeaveModalProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();
  const [form] = Form.useForm<{ reason: string }>();
  const { rejectRequest, isRejecting } = useLeaveRequestMutations();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (request) {
      setError(null);
      form.resetFields();
    }
  }, [request, form]);

  const handleSubmit = (values: { reason: string }) => {
    if (!request) {
      return;
    }

    void (async () => {
      setError(null);
      try {
        await rejectRequest({ id: request.id, reason: values.reason.trim() });
        onClose();
        message.success(t('leave.requests.rejectSuccess'));
      } catch (submitError) {
        setError(resolveError(submitError));
      }
    })();
  };

  return (
    <Modal
      open={Boolean(request)}
      title={
        request
          ? t('leave.requests.rejectTitle', {
              name: request.employee?.fullName ?? '',
              from: dayjs(request.startDate).format('DD/MM'),
              to: dayjs(request.endDate).format('DD/MM/YYYY'),
            })
          : ''
      }
      okText={t('leave.requests.reject')}
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

      <Form form={form} layout="vertical" onFinish={handleSubmit} disabled={isRejecting}>
        <Form.Item
          name="reason"
          label={t('leave.requests.rejectReason')}
          extra={t('leave.requests.rejectReasonHint')}
          rules={[
            { required: true, message: t('leave.requests.rejectReasonRequired') },
            { min: 5, message: t('leave.requests.reasonTooShort') },
          ]}
        >
          <Input.TextArea rows={3} maxLength={500} showCount autoFocus />
        </Form.Item>
      </Form>
    </Modal>
  );
}
