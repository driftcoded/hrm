import { useMemo } from 'react';
import { Select, type SelectProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { useEmployeeSearch } from '@/hooks/useEmployeeSearch';
import type { EmployeePickerItem } from '@/types/employee.types';

/**
 * Ô chọn nhân viên có tìm kiếm phía server.
 *
 * MÃ NHÂN VIÊN LUÔN ĐƯỢC HIỆN, và phòng ban khi có. Hai đồng nghiệp trùng tên
 * là chuyện bình thường ở Việt Nam — "Nguyễn Văn An" xuất hiện hai lần trong
 * danh sách chính là tình huống ô chọn này sinh ra để xử lý. Chọn nhầm người ở
 * đây nghĩa là ghi công hoặc ghi giờ làm thêm cho sai người.
 *
 * Endpoint hỏng thì ô chuyển sang trạng thái báo lỗi thay vì quay vòng vô hạn —
 * người dùng cần biết là không tìm được, chứ không phải đoán xem mình gõ sai.
 */
export interface EmployeeSelectProps
  extends Omit<SelectProps<number>, 'options' | 'onSearch' | 'filterOption'> {
  /** Chỉ gọi API khi ô thực sự đang mở/được dùng — form đóng thì không tìm kiếm. */
  enabled?: boolean;
}

export function EmployeeSelect({
  enabled = true,
  ...selectProps
}: EmployeeSelectProps) {
  const { t } = useTranslation();
  const search = useEmployeeSearch({ enabled });

  const options = useMemo(
    () => Object.values(search.known).map((employee) => toOption(employee)),
    [search.known],
  );

  return (
    <Select<number>
      showSearch
      // Lọc phía SERVER: danh sách chỉ có tối đa vài chục kết quả vừa trả về,
      // lọc lại phía client sẽ giấu mất những người chưa nằm trong đó.
      filterOption={false}
      onSearch={search.onSearch}
      loading={search.isSearching}
      options={options}
      notFoundContent={
        search.isError
          ? t('employees.picker.error')
          : search.isSearching
            ? t('employees.picker.searching')
            : t('employees.picker.empty')
      }
      {...selectProps}
    />
  );
}

function toOption(employee: EmployeePickerItem): {
  value: number;
  label: string;
} {
  const suffix = employee.department ? ` · ${employee.department.name}` : '';

  return {
    value: employee.id,
    label: `${employee.fullName} (${employee.employeeCode})${suffix}`,
  };
}
