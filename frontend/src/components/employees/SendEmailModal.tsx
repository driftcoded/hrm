import { useEffect } from 'react';
import { Alert, Form, Input, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import styles from './SendEmailModal.module.css';

/**
 * Soạn và gửi email cho các nhân viên đang chọn ở bảng.
 *
 * Component trình bày thuần — trang sở hữu vùng chọn và gọi hook (frontend/
 * CLAUDE.md: components/ không gọi API).
 *
 * Nội dung là văn bản THUẦN, không có trình soạn thảo giàu định dạng: backend
 * escape toàn bộ trước khi dựng HTML, nên một ô nhập cho gõ thẻ vào sẽ chỉ tạo
 * ra kỳ vọng sai.
 */

interface SendEmailFormValues {
  subject: string;
  body: string;
}

export interface SendEmailModalProps {
  open: boolean;
  /** Số nhân viên đang chọn — hiện ra để không ai gửi nhầm quy mô. */
  recipientCount: number;
  isSending: boolean;
  onCancel: () => void;
  onSubmit: (values: SendEmailFormValues) => void;
}

export function SendEmailModal({
  open,
  recipientCount,
  isSending,
  onCancel,
  onSubmit,
}: SendEmailModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<SendEmailFormValues>();

  // Đóng rồi mở lại là một email MỚI, không phải bản nháp cũ của lần trước.
  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  return (
    <Modal
      open={open}
      title={t('employees.email.title')}
      okText={t('employees.email.send')}
      cancelText={t('common.cancel')}
      confirmLoading={isSending}
      onCancel={onCancel}
      onOk={() => {
        void form.validateFields().then(onSubmit);
      }}
      destroyOnHidden
    >
      {/* Số người nhận là thứ dễ nhầm nhất ở một thao tác hàng loạt, nên nó
          đứng ngay trên ô nhập chứ không nằm trong tiêu đề. */}
      <Alert
        type="info"
        showIcon
        className={styles.recipients}
        title={t('employees.email.recipients', { count: recipientCount })}
      />

      <Form form={form} layout="vertical" disabled={isSending}>
        <Form.Item
          name="subject"
          label={t('employees.email.subject')}
          rules={[
            { required: true, message: t('employees.email.subjectRequired') },
            { min: 3, max: 200, message: t('employees.email.subjectLength') },
          ]}
        >
          <Input maxLength={200} showCount />
        </Form.Item>

        <Form.Item
          name="body"
          label={t('employees.email.body')}
          extra={t('employees.email.bodyHint')}
          rules={[
            { required: true, message: t('employees.email.bodyRequired') },
            { min: 10, max: 5000, message: t('employees.email.bodyLength') },
          ]}
        >
          <Input.TextArea rows={8} maxLength={5000} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}
