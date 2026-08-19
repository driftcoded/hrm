import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import type { SalaryStatus } from '@/types/payroll.types';

/**
 * Trạng thái một phiếu lương.
 *
 * MÀU ĐI THEO NGHĨA "TIỀN ĐÃ ĐI TỚI ĐÂU", không phải theo thứ tự vòng đời:
 * `calculated` là số nháp còn sửa được (xanh dương, trung tính), `approved` là
 * đã chốt chi (xanh lá), `paid` là tiền đã ra (xám — việc đã xong, không cần
 * hút mắt nữa), `cancelled` là dòng bỏ đi (đỏ).
 */
const COLORS: Record<SalaryStatus, string> = {
  draft: 'default',
  calculated: 'blue',
  approved: 'green',
  paid: 'default',
  cancelled: 'red',
};

export interface SalaryStatusTagProps {
  status: SalaryStatus;
}

export function SalaryStatusTag({ status }: SalaryStatusTagProps) {
  const { t } = useTranslation();

  return (
    <Tag color={COLORS[status]} bordered={false}>
      {t(`payroll.status.${status}`)}
    </Tag>
  );
}
