import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveOvertimeRequest,
  cancelOvertimeRequest,
  createAttendance,
  createOvertimeRequest,
  downloadImportTemplate,
  importAttendances,
  listAttendances,
  listOvertimeRequests,
  rejectOvertimeRequest,
  updateAttendance,
} from '@/services/attendance.service';
import { exportAttendances } from '@/services/report.service';
import type {
  AttendanceFilters,
  CreateAttendancePayload,
  CreateOvertimePayload,
  OvertimeFilters,
  UpdateAttendancePayload,
} from '@/types/attendance.types';
import { saveBlob } from '@/utils/download';

/**
 * Query key của module Chấm công.
 *
 * `root` để mọi thay đổi (nhập tay, sửa, nạp file) làm mới TẤT CẢ màn hình của
 * module cùng lúc: bảng chấm công và danh sách giờ làm thêm đọc chồng lên cùng
 * một tháng dữ liệu, để một cái cũ hơn cái kia là để người dùng thấy hai sự thật.
 */
export const ATTENDANCE_KEYS = {
  root: ['attendances'] as const,
  list: (filters?: AttendanceFilters) => ['attendances', 'list', filters] as const,
  overtime: (filters?: OvertimeFilters) => ['attendances', 'overtime', filters] as const,
};

export function useAttendances(filters?: AttendanceFilters) {
  return useQuery({
    queryKey: ATTENDANCE_KEYS.list(filters),
    queryFn: () => listAttendances(filters),
  });
}

export function useOvertimeRequests(filters?: OvertimeFilters, enabled = true) {
  return useQuery({
    queryKey: ATTENDANCE_KEYS.overtime(filters),
    queryFn: () => listOvertimeRequests(filters),
    enabled,
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

/** Đăng ký, duyệt, từ chối, huỷ đơn làm thêm giờ. */
export function useOvertimeMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ATTENDANCE_KEYS.root });
  };

  const create = useMutation({
    mutationFn: (payload: CreateOvertimePayload) => createOvertimeRequest(payload),
    onSuccess: invalidate,
  });

  const approve = useMutation({
    mutationFn: (id: number) => approveOvertimeRequest(id),
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      rejectOvertimeRequest(id, reason),
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: (id: number) => cancelOvertimeRequest(id),
    onSuccess: invalidate,
  });

  return {
    createOvertime: create.mutateAsync,
    approveOvertime: approve.mutateAsync,
    rejectOvertime: reject.mutateAsync,
    cancelOvertime: cancel.mutateAsync,
    isCreating: create.isPending,
    isApproving: approve.isPending,
    isRejecting: reject.isPending,
    isCancelling: cancel.isPending,
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
