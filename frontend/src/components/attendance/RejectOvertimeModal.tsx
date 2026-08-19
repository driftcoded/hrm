import { useEffect, useState } from 'react';
import { Alert, App, Form, Input, Modal } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useOvertimeMutations } from '@/hooks/useAttendances';
import type { OvertimeRequest } from '@/types/attendance.types';

/**
 * Từ chối một đơn làm thêm giờ.
 *
 * LÝ DO LÀ BẮT BUỘC, và đó là lý do modal này tồn tại thay vì một
 * `Popconfirm` như nút Duyệt. Từ chối mà không nói vì sao thì người nộp không
 * biết sửa gì để nộp lại, và người duyệt không phải chịu trách nhiệm về quyết
 * định của mình. Duyệt thì không cần lý do — nó là trạng thái mong đợi.
 */
export interface RejectOvertimeModalProps {
  /** `null` = đóng. */
  request: OvertimeRequest | null;
  onClose: () => void;
}

export function RejectOvertimeModal({ request, onClose }: RejectOvertimeModalProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();
  const [form] = Form.useForm<{ reason: string }>();
  const { rejectOvertime, isRejecting } = useOvertimeMutations();
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
        await rejectOvertime({ id: request.id, reason: values.reason.trim() });
        onClose();
        message.success(t('attendance.overtime.rejectSuccess'));
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
          ? t('attendance.overtime.rejectTitle', {
              name: request.employee?.fullName ?? '',
              date: dayjs(request.workDate).format('DD/MM/YYYY'),
            })
          : ''
      }
      okText={t('attendance.overtime.reject')}
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
          label={t('attendance.overtime.fields.rejectReason')}
          extra={t('attendance.overtime.fields.rejectReasonHint')}
          rules={[
            { required: true, message: t('attendance.overtime.errors.rejectReason') },
            { min: 5, message: t('attendance.overtime.errors.reasonTooShort') },
          ]}
        >
          <Input.TextArea rows={3} maxLength={500} showCount autoFocus />
        </Form.Item>
      </Form>
    </Modal>
  );
}
