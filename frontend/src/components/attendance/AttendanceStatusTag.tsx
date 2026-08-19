import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import type { AttendanceStatus } from '@/types/attendance.types';

/**
 * Nhãn trạng thái một ngày công.
 *
 * Màu là kênh THỨ HAI, không bao giờ là kênh duy nhất: mỗi nhãn mang chữ của
 * chính nó ("Đi muộn", "Nghỉ phép"…), nên người không phân biệt được màu và
 * bản in đen trắng vẫn đọc được (ui-conventions.md §11).
 *
 * `absent` và `holiday` cùng là "không đi làm" nhưng khác hẳn nhau về hệ quả:
 * một cái trừ công, một cái không. Chúng KHÔNG được dùng chung màu.
 */
const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: 'green',
  late: 'orange',
  early_leave: 'gold',
  absent: 'red',
  leave: 'blue',
  holiday: 'purple',
  wfh: 'cyan',
};

export interface AttendanceStatusTagProps {
  status: AttendanceStatus;
}

export function AttendanceStatusTag({ status }: AttendanceStatusTagProps) {
  const { t } = useTranslation();

  return (
    <Tag color={STATUS_COLORS[status]} bordered={false}>
      {t(`attendance.status.${status}`)}
    </Tag>
  );
}
