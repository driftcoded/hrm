import { useMutation } from '@tanstack/react-query';
import { exportEmployees } from '@/services/report.service';
import type { EmployeeFilters } from '@/types/employee.types';
import { saveBlob } from '@/utils/download';

/**
 * Xuất danh sách nhân viên ra .xlsx.
 *
 * Dùng `useMutation` chứ không phải `useQuery` dù đây là một `GET`: query sẽ
 * tự chạy khi component mount, tự chạy lại khi cửa sổ được focus, và cache lại
 * kết quả. Tải file là hành động do người dùng bấm — không được tự xảy ra, và
 * không có gì đáng cache: bấm lần nữa nghĩa là muốn file mới theo dữ liệu mới.
 *
 * Không `invalidateQueries` vì xuất file không đổi gì trên server.
 */
export function useExportEmployees() {
  const mutation = useMutation({
    mutationFn: async (filters?: EmployeeFilters) => {
      const file = await exportEmployees(filters);
      saveBlob(file.blob, file.filename);
      return file.filename;
    },
  });

  return {
    exportEmployees: mutation.mutateAsync,
    isExporting: mutation.isPending,
  };
}
