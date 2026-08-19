import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import type { OvertimeStatus } from '@/types/attendance.types';

/** Nhãn trạng thái đơn làm thêm giờ — màu kèm chữ, xem `AttendanceStatusTag`. */
const STATUS_COLORS: Record<OvertimeStatus, string> = {
  pending: 'gold',
  approved: 'green',
  rejected: 'red',
  cancelled: 'default',
};

export interface OvertimeStatusTagProps {
  status: OvertimeStatus;
}

export function OvertimeStatusTag({ status }: OvertimeStatusTagProps) {
  const { t } = useTranslation();

  return (
    <Tag color={STATUS_COLORS[status]} bordered={false}>
      {t(`attendance.overtime.status.${status}`)}
    </Tag>
  );
}
