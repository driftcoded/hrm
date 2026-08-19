import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import type { EmployeeStatus } from '@/types/employee.types';

/**
 * The status badge in the employee table.
 *
 * Color is a SECOND channel, never the only one: every badge carries its own
 * words ("Đang làm việc", "Thử việc"…), so the meaning survives a colorblind
 * reader and a grayscale print (docs/ui-conventions.md §11).
 *
 * The six values are exactly `employees.status` in the database. There is no
 * "sắp hết hợp đồng" badge here even though it would fit the visual family: an
 * expiring contract is a fact about the CONTRACT, not a state of the employee,
 * and a table row does not carry the contract's end date. That number has its
 * own overview tile, fed by `GET /employees/stats`.
 */
const STATUS_COLORS: Record<EmployeeStatus, string> = {
  probation: 'orange',
  active: 'green',
  on_leave: 'blue',
  suspended: 'red',
  resigned: 'default',
  terminated: 'default',
};

export interface EmployeeStatusTagProps {
  status: EmployeeStatus;
}

export function EmployeeStatusTag({ status }: EmployeeStatusTagProps) {
  const { t } = useTranslation();

  return (
    <Tag color={STATUS_COLORS[status]} bordered={false}>
      {t(`employees.status.${status}`)}
    </Tag>
  );
}
