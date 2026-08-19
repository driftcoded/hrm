import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveOvertimeRequest,
  cancelOvertimeRequest,
  checkIn,
  checkOut,
  createOvertimeRequest,
  downloadImportTemplate,
  getMyAttendance,
  importAttendances,
  listAttendances,
  listOvertimeRequests,
  rejectOvertimeRequest,
  updateAttendance,
} from '@/services/attendance.service';
import { exportAttendances } from '@/services/report.service';
import type {
  AttendanceFilters,
  CreateOvertimePayload,
  OvertimeFilters,
  UpdateAttendancePayload,
} from '@/types/attendance.types';
import { saveBlob } from '@/utils/download';

/**
 * Query key của module Chấm công.
 *
 * `root` để mọi thay đổi (chấm công, HR sửa, nạp file) làm mới TẤT CẢ màn hình
 * chấm công cùng lúc: bảng công cá nhân và bảng công toàn công ty đọc cùng một
 * dữ liệu, để một cái cũ hơn cái kia là để người dùng thấy hai sự thật.
 */
export const ATTENDANCE_KEYS = {
  root: ['attendances'] as const,
  list: (filters?: AttendanceFilters) => ['attendances', 'list', filters] as const,
  mine: (month?: number, year?: number) => ['attendances', 'me', month, year] as const,
  overtime: (filters?: OvertimeFilters) => ['attendances', 'overtime', filters] as const,
};

export function useMyAttendance(month?: number, year?: number) {
  return useQuery({
    queryKey: ATTENDANCE_KEYS.mine(month, year),
    queryFn: () => getMyAttendance({ month, year }),
  });
}

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

/** Chấm vào / chấm ra cho chính mình. */
export function useAttendanceClock() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ATTENDANCE_KEYS.root });
  };

  const inMutation = useMutation({
    mutationFn: (note?: string) => checkIn(note),
    onSuccess: invalidate,
  });

  const outMutation = useMutation({
    mutationFn: (note?: string) => checkOut(note),
    onSuccess: invalidate,
  });

  return {
    checkIn: inMutation.mutateAsync,
    checkOut: outMutation.mutateAsync,
    isClockingIn: inMutation.isPending,
    isClockingOut: outMutation.isPending,
  };
}

/** HR điều chỉnh một ngày công. */
export function useAttendanceMutations() {
  const queryClient = useQueryClient();

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateAttendancePayload }) =>
      updateAttendance(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ATTENDANCE_KEYS.root });
    },
  });

  return { updateAttendance: update.mutateAsync, isSaving: update.isPending };
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
