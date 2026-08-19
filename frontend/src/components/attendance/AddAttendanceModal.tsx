import { useEffect, useState } from 'react';
import { Alert, App, DatePicker, Form, Input, Modal, Select, TimePicker } from 'antd';
import type { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { EmployeeSelect } from '@/components/employees/EmployeeSelect';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useAttendanceMutations } from '@/hooks/useAttendances';
import {
  ATTENDANCE_STATUSES,
  type AttendanceStatus,
} from '@/types/attendance.types';
import styles from './AddAttendanceModal.module.css';

/**
 * Nhập MỘT ngày công.
 *
 * Đường chính để đưa dữ liệu vào là nạp file Excel từ nền tảng chấm công bên
 * ngoài. Form này dành cho những ca lẻ file không có: nhân viên quên chấm, đi
 * công tác, làm tại nhà, hoặc một ngày nghỉ phép cần được ghi vào bảng công.
 *
 * GIỜ VÀO/RA LÀ TUỲ CHỌN. Một ngày nghỉ phép hay ngày lễ vẫn là một dòng trong
 * bảng công, chỉ là không có giờ nào — bắt buộc nhập giờ sẽ khiến người dùng
 * phải bịa ra một con số cho ngày không ai đi làm.
 *
 * GIỜ NGHỈ cũng tuỳ chọn: điền vào thì trừ đúng khoảng đó, bỏ trống thì trừ
 * theo khung nghỉ chuẩn của công ty.
 *
 * KHÔNG có giờ vào thì TRẠNG THÁI thành bắt buộc: thiếu cả hai, bản ghi rơi về
 * mặc định `present` của cột và trở thành một dòng nói người đó đi làm mà không
 * có căn cứ nào.
 */
export interface AddAttendanceModalProps {
  open: boolean;
  onClose: () => void;
  /** Tháng đang xem trên bảng — dùng làm ngày mặc định cho tiện. */
  defaultDate?: Dayjs;
}

interface FormValues {
  employeeId: number;
  workDate: Dayjs;
  checkIn?: Dayjs | null;
  checkOut?: Dayjs | null;
  breakStart?: Dayjs | null;
  breakEnd?: Dayjs | null;
  status?: AttendanceStatus;
  note?: string;
}

const TIME_FORMAT = 'HH:mm';

export function AddAttendanceModal({
  open,
  onClose,
  defaultDate,
}: AddAttendanceModalProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();
  const [form] = Form.useForm<FormValues>();
  const { createAttendance, isCreating } = useAttendanceMutations();
  const [error, setError] = useState<string | null>(null);
  const hasCheckIn = Boolean(Form.useWatch('checkIn', form));

  useEffect(() => {
    if (open) {
      setError(null);
      form.resetFields();
      if (defaultDate) {
        form.setFieldValue('workDate', defaultDate);
      }
    }
  }, [open, form, defaultDate]);

  const handleSubmit = (values: FormValues) => {
    void (async () => {
      setError(null);
      try {
        await createAttendance({
          employeeId: values.employeeId,
          workDate: values.workDate.format('YYYY-MM-DD'),
          checkIn: values.checkIn?.format(TIME_FORMAT),
          checkOut: values.checkOut?.format(TIME_FORMAT),
          breakStart: values.breakStart?.format(TIME_FORMAT),
          breakEnd: values.breakEnd?.format(TIME_FORMAT),
          status: values.status,
          note: values.note?.trim(),
        });
        onClose();
        message.success(t('attendance.add.success'));
      } catch (submitError) {
        setError(resolveError(submitError));
      }
    })();
  };

  return (
    <Modal
      open={open}
      title={t('attendance.add.title')}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      confirmLoading={isCreating}
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      {error && (
        <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />
      )}

      <Form form={form} layout="vertical" onFinish={handleSubmit} disabled={isCreating}>
        <Form.Item
          name="employeeId"
          label={t('attendance.add.employee')}
          rules={[{ required: true, message: t('attendance.add.employeeRequired') }]}
        >
          <EmployeeSelect
            enabled={open}
            placeholder={t('attendance.add.employeePlaceholder')}
          />
        </Form.Item>

        <Form.Item
          name="workDate"
          label={t('attendance.columns.workDate')}
          rules={[{ required: true, message: t('attendance.add.dateRequired') }]}
        >
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
        </Form.Item>

        <div className={styles.timeRow}>
          <Form.Item name="checkIn" label={t('attendance.fields.checkIn')}>
            <TimePicker format={TIME_FORMAT} minuteStep={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="checkOut" label={t('attendance.fields.checkOut')}>
            <TimePicker format={TIME_FORMAT} minuteStep={1} style={{ width: '100%' }} />
          </Form.Item>
        </div>

        <div className={styles.timeRow}>
          <Form.Item name="breakStart" label={t('attendance.fields.breakStart')}>
            <TimePicker format={TIME_FORMAT} minuteStep={5} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="breakEnd" label={t('attendance.fields.breakEnd')}>
            <TimePicker format={TIME_FORMAT} minuteStep={5} style={{ width: '100%' }} />
          </Form.Item>
        </div>

        <Form.Item
          name="status"
          label={t('attendance.fields.status')}
          rules={[
            {
              // Bắt ở form thay vì đợi 422 từ server: người dùng biết ngay trong
              // lúc điền, không phải sau khi bấm Lưu.
              required: !hasCheckIn,
              message: t('attendance.add.statusRequired'),
            },
          ]}
        >
          <Select
            allowClear
            options={ATTENDANCE_STATUSES.map((value) => ({
              value,
              label: t(`attendance.status.${value}`),
            }))}
          />
        </Form.Item>

        <Form.Item name="note" label={t('attendance.fields.note')}>
          <Input.TextArea rows={2} maxLength={500} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}
