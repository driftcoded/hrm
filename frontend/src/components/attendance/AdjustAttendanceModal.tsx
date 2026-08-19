import { useEffect, useState } from 'react';
import { Alert, App, Form, Input, Modal, Select, TimePicker } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useAttendanceMutations } from '@/hooks/useAttendances';
import {
  ATTENDANCE_STATUSES,
  type AttendanceRecord,
  type AttendanceStatus,
} from '@/types/attendance.types';

/**
 * HR điều chỉnh một ngày công (máy chấm công lỗi, nhân viên quên chấm).
 *
 * LÝ DO LÀ BẮT BUỘC. Sửa bảng chấm công là sửa căn cứ trả lương của một con
 * người; bản ghi sau khi sửa phải tự nói được vì sao nó khác thứ máy đã ghi.
 * Backend cũng bắt buộc `note`, nên bỏ nó ở đây chỉ đổi một lỗi rõ ràng ngay
 * trên form thành một lỗi 422 sau khi bấm Lưu.
 *
 * Lỗi submit hiện `Alert` NGAY TRONG modal, không dùng toast: người dùng đang
 * nhìn vào form, và một toast góc màn hình sẽ biến mất trước khi họ đọc xong.
 */
export interface AdjustAttendanceModalProps {
  /** `null` = đóng. Bản ghi đang sửa. */
  record: AttendanceRecord | null;
  onClose: () => void;
}

interface FormValues {
  checkIn?: dayjs.Dayjs | null;
  checkOut?: dayjs.Dayjs | null;
  breakStart?: dayjs.Dayjs | null;
  breakEnd?: dayjs.Dayjs | null;
  status?: AttendanceStatus;
  note: string;
}

const TIME_FORMAT = 'HH:mm';

export function AdjustAttendanceModal({ record, onClose }: AdjustAttendanceModalProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();
  const [form] = Form.useForm<FormValues>();
  const { updateAttendance, isSaving } = useAttendanceMutations();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!record) {
      return;
    }

    setError(null);
    form.setFieldsValue({
      checkIn: record.checkIn ? dayjs(record.checkIn, TIME_FORMAT) : null,
      checkOut: record.checkOut ? dayjs(record.checkOut, TIME_FORMAT) : null,
      breakStart: record.breakStart ? dayjs(record.breakStart, TIME_FORMAT) : null,
      breakEnd: record.breakEnd ? dayjs(record.breakEnd, TIME_FORMAT) : null,
      status: record.status,
      note: '',
    });
  }, [record, form]);

  const handleSubmit = (values: FormValues) => {
    if (!record) {
      return;
    }

    void (async () => {
      setError(null);
      try {
        await updateAttendance({
          id: record.id,
          payload: {
            checkIn: values.checkIn?.format(TIME_FORMAT),
            checkOut: values.checkOut?.format(TIME_FORMAT),
            breakStart: values.breakStart?.format(TIME_FORMAT),
            breakEnd: values.breakEnd?.format(TIME_FORMAT),
            status: values.status,
            note: values.note.trim(),
          },
        });
        onClose();
        message.success(t('attendance.adjust.success'));
      } catch (submitError) {
        setError(resolveError(submitError));
      }
    })();
  };

  return (
    <Modal
      open={Boolean(record)}
      title={
        record
          ? t('attendance.adjust.title', {
              name: record.employee?.fullName ?? '',
              date: dayjs(record.workDate).format('DD/MM/YYYY'),
            })
          : ''
      }
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      confirmLoading={isSaving}
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      {error && (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
      )}

      <Form form={form} layout="vertical" onFinish={handleSubmit} disabled={isSaving}>
        <Form.Item name="checkIn" label={t('attendance.fields.checkIn')}>
          <TimePicker format={TIME_FORMAT} minuteStep={1} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="checkOut" label={t('attendance.fields.checkOut')}>
          <TimePicker format={TIME_FORMAT} minuteStep={1} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="breakStart" label={t('attendance.fields.breakStart')}>
          <TimePicker format={TIME_FORMAT} minuteStep={5} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="breakEnd" label={t('attendance.fields.breakEnd')}>
          <TimePicker format={TIME_FORMAT} minuteStep={5} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="status"
          label={t('attendance.fields.status')}
          // Máy không biết hôm đó nhân viên làm ở nhà; chỉ HR đặt được `wfh`.
          extra={t('attendance.adjust.statusHint')}
        >
          <Select
            allowClear
            options={ATTENDANCE_STATUSES.map((value) => ({
              value,
              label: t(`attendance.status.${value}`),
            }))}
          />
        </Form.Item>

        <Form.Item
          name="note"
          label={t('attendance.fields.reason')}
          rules={[
            { required: true, message: t('attendance.adjust.reasonRequired') },
            { min: 3, message: t('attendance.adjust.reasonTooShort') },
          ]}
          extra={t('attendance.adjust.reasonHint')}
        >
          <Input.TextArea rows={3} maxLength={500} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}
