import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAttendance,
  downloadImportTemplate,
  getAttendanceStats,
  importAttendances,
  listAttendances,
  updateAttendance,
} from '@/services/attendance.service';
import { exportAttendances } from '@/services/report.service';
import type {
  AttendanceFilters,
  AttendanceStatsFilters,
  CreateAttendancePayload,
  UpdateAttendancePayload,
} from '@/types/attendance.types';
import { saveBlob } from '@/utils/download';

/**
 * Query key của module Chấm công.
 *
 * `root` để mọi thay đổi (nhập tay, sửa, nạp file) làm mới TẤT CẢ màn hình đọc
 * bảng công cùng lúc — sửa một ngày công là đổi luôn giờ làm và giờ làm thêm của
 * tháng đó, nên không màn hình nào được giữ số cũ.
 */
export const ATTENDANCE_KEYS = {
  root: ['attendances'] as const,
  list: (filters?: AttendanceFilters) => ['attendances', 'list', filters] as const,
  stats: (filters?: AttendanceStatsFilters) =>
    ['attendances', 'stats', filters] as const,
};

export function useAttendances(filters?: AttendanceFilters) {
  return useQuery({
    queryKey: ATTENDANCE_KEYS.list(filters),
    queryFn: () => listAttendances(filters),
  });
}

/**
 * Số liệu cho biểu đồ chấm công.
 *
 * Một lần gọi trả cả tháng, nên đổi ngày trên biểu đồ không gọi lại server.
 * Key nằm dưới `ATTENDANCE_KEYS.root` nên mọi thay đổi ngày công đều làm mới.
 */
export function useAttendanceStats(filters?: AttendanceStatsFilters) {
  return useQuery({
    queryKey: ATTENDANCE_KEYS.stats(filters),
    queryFn: () => getAttendanceStats(filters),
  });
}

/** Nhân sự nhập tay / điều chỉnh một ngày công. */
export function useAttendanceMutations() {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: (payload: CreateAttendancePayload) => createAttendance(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ATTENDANCE_KEYS.root });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateAttendancePayload }) =>
      updateAttendance(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ATTENDANCE_KEYS.root });
    },
  });

  return {
    createAttendance: create.mutateAsync,
    updateAttendance: update.mutateAsync,
    isCreating: create.isPending,
    isSaving: update.isPending,
  };
}

/**
 * Nạp file chấm công.
 *
 * Hai bước tách bạch: `validate` chạy `dryRun` để người dùng thấy trước sẽ ghi
 * đè bao nhiêu ngày công, `commit` mới ghi thật. Chỉ `commit` mới làm mới cache
 * — một lần chạy thử không đổi gì trên server nên không có gì để làm mới.
 */
export function useAttendanceImport() {
  const queryClient = useQueryClient();

  const validate = useMutation({
    mutationFn: (file: File) => importAttendances(file, { dryRun: true }),
  });

  const commit = useMutation({
    mutationFn: (file: File) => importAttendances(file, { dryRun: false }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ATTENDANCE_KEYS.root });
    },
  });

  const template = useMutation({
    mutationFn: async () => {
      const file = await downloadImportTemplate();
      saveBlob(file.blob, file.filename);
      return file.filename;
    },
  });

  return {
    validate: validate.mutateAsync,
    commit: commit.mutateAsync,
    downloadTemplate: template.mutateAsync,
    isValidating: validate.isPending,
    isCommitting: commit.isPending,
    isDownloadingTemplate: template.isPending,
  };
}


/** Xuất bảng chấm công tháng ra Excel — xem `useExportEmployees` cho lý do dùng mutation. */
export function useExportAttendances() {
  const mutation = useMutation({
    mutationFn: async (filter: {
      month: number;
      year: number;
      departmentId?: number;
      employeeId?: number;
    }) => {
      const file = await exportAttendances(filter);
      saveBlob(file.blob, file.filename);
      return file.filename;
    },
  });

  return { exportAttendances: mutation.mutateAsync, isExporting: mutation.isPending };
}
