import { useEffect, useState } from 'react';
import { Alert, App, DatePicker, Form, Input, Modal, TimePicker } from 'antd';
import type { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { EmployeeSelect } from '@/components/employees/EmployeeSelect';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useOvertimeMutations } from '@/hooks/useAttendances';
import styles from './OvertimeFormModal.module.css';

/**
 * Form GHI NHẬN giờ làm thêm cho một nhân viên (PLAN 4.2).
 *
 * KHÔNG PHẢI FORM TỰ ĐĂNG KÝ. Nhân viên không đăng nhập hệ thống này; thoả
 * thuận làm thêm giờ diễn ra bên ngoài (Điều 107 BLLĐ 2019 đòi có sự đồng ý của
 * NLĐ), và quản lý/nhân sự ghi lại vào đây. Ô đầu tiên vì thế là CHỌN NHÂN
 * VIÊN, và `reason` là chỗ duy nhất ghi lại thoả thuận đó.
 *
 * BA THỨ NGƯỜI DÙNG *KHÔNG* NHẬP: số giờ, loại ngày, hệ số. Cả ba đều do server
 * suy ra từ ngày + khung giờ. Cho nhập là cho khai 8 giờ cho một ca 2 tiếng,
 * hoặc tự chọn hệ số ngày lễ cho một ngày thường.
 *
 * Số giờ vẫn được TÍNH SẴN VÀ HIỆN RA ngay dưới form — người ta cần biết mình
 * đang xin bao nhiêu giờ trước khi bấm gửi. Con số này chỉ để xem: server tính
 * lại từ đầu và đó mới là con số được lưu.
 *
 * Lỗi hiện `Alert` trong modal, không dùng toast — người dùng đang nhìn form,
 * và các mã lỗi ở đây (`OVERLAPPING_OVERTIME`, vượt trần Điều 107) là thứ họ
 * phải đọc để sửa.
 */
export interface OvertimeFormModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormValues {
  employeeId: number;
  workDate: Dayjs;
  startTime: Dayjs;
  endTime: Dayjs;
  reason: string;
}

const TIME_FORMAT = 'HH:mm';
const MINUTES_PER_DAY = 24 * 60;

export function OvertimeFormModal({ open, onClose }: OvertimeFormModalProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();
  const [form] = Form.useForm<FormValues>();
  const { createOvertime, isCreating } = useOvertimeMutations();
  const [error, setError] = useState<string | null>(null);

  const startTime = Form.useWatch('startTime', form);
  const endTime = Form.useWatch('endTime', form);
  const hours = estimateHours(startTime, endTime);

  useEffect(() => {
    if (open) {
      setError(null);
      form.resetFields();
    }
  }, [open, form]);

  const handleSubmit = (values: FormValues) => {
    void (async () => {
      setError(null);
      try {
        await createOvertime({
          employeeId: values.employeeId,
          workDate: values.workDate.format('YYYY-MM-DD'),
          startTime: values.startTime.format(TIME_FORMAT),
          endTime: values.endTime.format(TIME_FORMAT),
          reason: values.reason.trim(),
        });
        onClose();
        message.success(t('attendance.overtime.createSuccess'));
      } catch (submitError) {
        setError(resolveError(submitError));
      }
    })();
  };

  return (
    <Modal
      open={open}
      title={t('attendance.overtime.create')}
      okText={t('attendance.overtime.submit')}
      cancelText={t('common.cancel')}
      confirmLoading={isCreating}
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      {error && (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
      )}

      <Form form={form} layout="vertical" onFinish={handleSubmit} disabled={isCreating}>
        <Form.Item
          name="employeeId"
          label={t('attendance.overtime.fields.employee')}
          rules={[{ required: true, message: t('attendance.overtime.errors.employee') }]}
        >
          <EmployeeSelect
            enabled={open}
            placeholder={t('attendance.overtime.fields.employeePlaceholder')}
          />
        </Form.Item>

        <Form.Item
          name="workDate"
          label={t('attendance.overtime.fields.workDate')}
          rules={[{ required: true, message: t('attendance.overtime.errors.workDate') }]}
        >
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
        </Form.Item>

        <div className={styles.timeRow}>
          <Form.Item
            name="startTime"
            label={t('attendance.overtime.fields.startTime')}
            rules={[{ required: true, message: t('attendance.overtime.errors.startTime') }]}
          >
            <TimePicker format={TIME_FORMAT} minuteStep={15} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="endTime"
            label={t('attendance.overtime.fields.endTime')}
            // Ca đêm vắt qua nửa đêm là bình thường ở nhà máy — nói rõ để không
            // ai tưởng mình nhập sai khi giờ kết thúc nhỏ hơn giờ bắt đầu.
            extra={t('attendance.overtime.fields.endTimeHint')}
            rules={[{ required: true, message: t('attendance.overtime.errors.endTime') }]}
          >
            <TimePicker format={TIME_FORMAT} minuteStep={15} style={{ width: '100%' }} />
          </Form.Item>
        </div>

        {hours !== null && (
          <p className={styles.estimate}>
            {t('attendance.overtime.estimate', { hours })}
          </p>
        )}

        <Form.Item
          name="reason"
          label={t('attendance.overtime.fields.reason')}
          extra={t('attendance.overtime.fields.reasonHint')}
          rules={[
            { required: true, message: t('attendance.overtime.errors.reason') },
            { min: 5, message: t('attendance.overtime.errors.reasonTooShort') },
          ]}
        >
          <Input.TextArea rows={3} maxLength={500} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/**
 * Số giờ dự kiến, tính y hệt server: kết thúc <= bắt đầu nghĩa là sang ngày
 * hôm sau.
 *
 * CHỈ ĐỂ XEM. Server tính lại từ đầu, và con số của server mới là con số được
 * lưu — hai bên lệch nhau thì đó là lỗi, không phải một cách hiển thị khác.
 */
function estimateHours(start?: Dayjs | null, end?: Dayjs | null): number | null {
  if (!start || !end) {
    return null;
  }

  const startMinutes = start.hour() * 60 + start.minute();
  const rawEnd = end.hour() * 60 + end.minute();
  const endMinutes = rawEnd <= startMinutes ? rawEnd + MINUTES_PER_DAY : rawEnd;

  return Math.round(((endMinutes - startMinutes) / 60) * 100) / 100;
}
