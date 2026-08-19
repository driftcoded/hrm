import { ContractType } from '@/modules/contracts/entities/contract.entity';
import {
  EmployeeStatus,
  Gender,
} from '@/modules/employees/entities/employee.entity';

/**
 * Nhãn tiếng Việt cho các enum xuất hiện trong file Excel.
 *
 * API trả enum dạng máy đọc (`fixed_term`) vì frontend tự dịch; file Excel thì
 * người đọc trực tiếp, nên phải dịch tại chỗ. Bảng nhãn đặt ở module reports
 * chứ không sửa DTO của module khác.
 */

const GENDER_LABELS: Record<Gender, string> = {
  [Gender.MALE]: 'Nam',
  [Gender.FEMALE]: 'Nữ',
  [Gender.OTHER]: 'Khác',
};

const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  [EmployeeStatus.PROBATION]: 'Thử việc',
  [EmployeeStatus.ACTIVE]: 'Đang làm việc',
  [EmployeeStatus.ON_LEAVE]: 'Nghỉ không lương',
  [EmployeeStatus.SUSPENDED]: 'Tạm đình chỉ',
  [EmployeeStatus.RESIGNED]: 'Đã nghỉ việc',
  [EmployeeStatus.TERMINATED]: 'Chấm dứt hợp đồng',
};

const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  [ContractType.PROBATION]: 'Thử việc',
  [ContractType.FIXED_TERM]: 'Xác định thời hạn',
  [ContractType.INDEFINITE]: 'Không xác định thời hạn',
  [ContractType.SEASONAL]: 'Thời vụ',
};

/**
 * Trả về nhãn tiếng Việt, hoặc chính giá trị gốc nếu enum được bổ sung ở nơi
 * khác mà bảng nhãn chưa cập nhật — thà hiện `new_status` còn hơn ô trống làm
 * người đọc tưởng dữ liệu bị thiếu.
 */
function labelOf<T extends string>(
  labels: Record<T, string>,
  value: T | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return labels[value] ?? value;
}

export const genderLabel = (value: Gender | null | undefined): string | null =>
  labelOf(GENDER_LABELS, value);

export const employeeStatusLabel = (
  value: EmployeeStatus | null | undefined,
): string | null => labelOf(EMPLOYEE_STATUS_LABELS, value);

export const contractTypeLabel = (
  value: ContractType | null | undefined,
): string | null => labelOf(CONTRACT_TYPE_LABELS, value);
