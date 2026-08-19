import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import type { LeaveStatus } from '@/types/leave.types';

/**
 * Nhãn trạng thái đơn nghỉ phép.
 *
 * Màu là kênh THỨ HAI, không bao giờ là kênh duy nhất: mỗi nhãn mang chữ của
 * chính nó, nên người không phân biệt được màu và bản in đen trắng vẫn đọc được
 * (ui-conventions.md §11).
 */
const STATUS_COLORS: Record<LeaveStatus, string> = {
  pending: 'gold',
  approved: 'green',
  rejected: 'red',
  cancelled: 'default',
};

export interface LeaveStatusTagProps {
  status: LeaveStatus;
}

export function LeaveStatusTag({ status }: LeaveStatusTagProps) {
  const { t } = useTranslation();

  return (
    <Tag color={STATUS_COLORS[status]} bordered={false}>
      {t(`leave.status.${status}`)}
    </Tag>
  );
}
