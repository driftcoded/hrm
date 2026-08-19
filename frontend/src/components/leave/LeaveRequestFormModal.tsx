import { useEffect, useMemo, useState } from 'react';
import { Alert, App, DatePicker, Form, Input, Modal, Select } from 'antd';
import type { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { EmployeeSelect } from '@/components/employees/EmployeeSelect';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useLeaveRequestMutations } from '@/hooks/useLeave';
import { useLeaveTypes } from '@/hooks/useLeaveTypes';
import { LEAVE_HALVES, type LeaveHalf } from '@/types/leave.types';
import styles from './LeaveRequestFormModal.module.css';

/**
 * Form GHI NHẬN đơn nghỉ phép cho một nhân viên (PLAN 5.2).
 *
 * KHÔNG PHẢI FORM TỰ NỘP ĐƠN. Nhân viên không đăng nhập hệ thống này; quản lý
 * ghi nhận cho phòng mình, nhân sự ghi cho bất kỳ ai. Ô đầu tiên vì thế là CHỌN
 * NHÂN VIÊN.
 *
 * SỐ NGÀY PHÉP KHÔNG PHẢI MỘT Ô NHẬP — server tính từ khoảng ngày, nửa ngày ở
 * hai đầu và lịch nghỉ lễ. Cho nhập là cho khai 1 ngày cho một kỳ nghỉ hai tuần.
 * Con số ước tính vẫn được hiện ngay dưới form vì người ghi cần biết mình đang
 * trừ của nhân viên bao nhiêu ngày trước khi bấm gửi; nhưng nó KHÔNG trừ ngày
 * lễ (giao diện không có lịch lễ), nên được nói rõ là ước tính.
 */
export interface LeaveRequestFormModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormValues {
  employeeId: number;
  leaveTypeId: number;
  range: [Dayjs, Dayjs];
  startHalf?: LeaveHalf;
  endHalf?: LeaveHalf;
  reason: string;
}

export function LeaveRequestFormModal({
  open,
  onClose,
}: LeaveRequestFormModalProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const resolveError = useApiErrorMessage();
  const [form] = Form.useForm<FormValues>();
  const { createRequest, isCreating } = useLeaveRequestMutations();
  const [error, setError] = useState<string | null>(null);

  // Danh mục loại phép chỉ có chục dòng — không phân trang, `data` là mảng.
  const leaveTypes = useLeaveTypes({ isActive: true });

  const range = Form.useWatch('range', form);
  const startHalf = Form.useWatch('startHalf', form);
  const endHalf = Form.useWatch('endHalf', form);

  const estimate = useMemo(
    () => estimateDays(range, startHalf, endHalf),
    [range, startHalf, endHalf],
  );

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
        await createRequest({
          employeeId: values.employeeId,
          leaveTypeId: values.leaveTypeId,
          startDate: values.range[0].format('YYYY-MM-DD'),
          endDate: values.range[1].format('YYYY-MM-DD'),
          startHalf: values.startHalf,
          endHalf: values.endHalf,
          reason: values.reason.trim(),
        });
        onClose();
        message.success(t('leave.requests.createSuccess'));
      } catch (submitError) {
        setError(resolveError(submitError));
      }
    })();
  };

  const halfOptions = LEAVE_HALVES.map((value) => ({
    value,
    label: t(`leave.half.${value}`),
  }));

  return (
    <Modal
      open={open}
      title={t('leave.requests.create')}
      okText={t('leave.requests.submit')}
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
          label={t('leave.requests.fields.employee')}
          rules={[{ required: true, message: t('leave.requests.errors.employee') }]}
        >
          <EmployeeSelect
            enabled={open}
            placeholder={t('leave.requests.fields.employeePlaceholder')}
          />
        </Form.Item>

        <Form.Item
          name="leaveTypeId"
          label={t('leave.requests.fields.leaveType')}
          rules={[{ required: true, message: t('leave.requests.errors.leaveType') }]}
        >
          <Select
            loading={leaveTypes.isLoading}
            options={(leaveTypes.data ?? []).map((type) => ({
              value: type.id,
              label: type.name,
            }))}
          />
        </Form.Item>

        <Form.Item
          name="range"
          label={t('leave.requests.fields.range')}
          rules={[{ required: true, message: t('leave.requests.errors.range') }]}
        >
          <DatePicker.RangePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
        </Form.Item>

        <div className={styles.halfRow}>
          <Form.Item name="startHalf" label={t('leave.requests.fields.startHalf')}>
            <Select allowClear options={halfOptions} />
          </Form.Item>

          <Form.Item name="endHalf" label={t('leave.requests.fields.endHalf')}>
            <Select allowClear options={halfOptions} />
          </Form.Item>
        </div>

        {estimate !== null && (
          <p className={styles.estimate}>
            {t('leave.requests.estimate', { days: estimate })}
          </p>
        )}

        <Form.Item
          name="reason"
          label={t('leave.requests.fields.reason')}
          rules={[
            { required: true, message: t('leave.requests.errors.reason') },
            { min: 5, message: t('leave.requests.reasonTooShort') },
          ]}
        >
          <Input.TextArea rows={3} maxLength={500} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/**
 * Số ngày phép ƯỚC TÍNH: đếm T2–T6 trong khoảng, trừ nửa ngày ở hai đầu.
 *
 * KHÔNG trừ ngày lễ — giao diện không có danh mục ngày lễ, và tải nó về chỉ để
 * hiện một con số tạm là không đáng. Server tính lại có cả ngày lễ, và con số
 * của server mới là con số được lưu; nhãn vì thế nói rõ đây là ước tính.
 */
function estimateDays(
  range?: [Dayjs, Dayjs] | null,
  startHalf?: LeaveHalf,
  endHalf?: LeaveHalf,
): number | null {
  if (!range?.[0] || !range[1]) {
    return null;
  }

  const [start, end] = range;
  const workingDays: string[] = [];

  for (
    let cursor = start.startOf('day');
    !cursor.isAfter(end, 'day');
    cursor = cursor.add(1, 'day')
  ) {
    const weekday = cursor.day();

    if (weekday !== 0 && weekday !== 6) {
      workingDays.push(cursor.format('YYYY-MM-DD'));
    }
  }

  if (workingDays.length === 0) {
    return 0;
  }

  let total = workingDays.length;
  const startDate = start.format('YYYY-MM-DD');
  const endDate = end.format('YYYY-MM-DD');

  if (isHalf(startHalf) && workingDays.includes(startDate)) {
    total -= 0.5;
  }

  // Kỳ nghỉ một ngày mà cả hai đầu đều nửa ngày thì vẫn là MỘT nửa ngày.
  if (startDate !== endDate && isHalf(endHalf) && workingDays.includes(endDate)) {
    total -= 0.5;
  }

  return Math.max(0, total);
}

function isHalf(half?: LeaveHalf): boolean {
  return half === 'morning' || half === 'afternoon';
}
