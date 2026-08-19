import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adjustLeaveBalance,
  deleteLeaveBalance,
  approveLeaveRequest,
  cancelLeaveRequest,
  createLeaveRequest,
  deleteLeaveRequest,
  initLeaveBalances,
  listLeaveBalances,
  listLeaveCalendar,
  listLeaveRequests,
  rejectLeaveRequest,
  updateLeaveRequest,
} from '@/services/leave.service';
import type {
  AdjustLeaveBalancePayload,
  CreateLeaveRequestPayload,
  InitLeaveBalancePayload,
  LeaveBalanceFilters,
  LeaveRequestFilters,
  UpdateLeaveRequestPayload,
} from '@/types/leave.types';

/**
 * Query key của module Nghỉ phép.
 *
 * `root` để mọi thay đổi làm mới TẤT CẢ màn hình cùng lúc: duyệt một đơn vừa
 * đổi danh sách đơn, vừa đổi quỹ phép, vừa đổi lịch nghỉ. Để một trong ba cái
 * cũ hơn hai cái kia là để người dùng thấy hai sự thật.
 */
export const LEAVE_KEYS = {
  root: ['leave'] as const,
  requests: (filters?: LeaveRequestFilters) =>
    ['leave', 'requests', filters] as const,
  balances: (filters?: LeaveBalanceFilters) =>
    ['leave', 'balances', filters] as const,
  calendar: (from: string, to: string) => ['leave', 'calendar', from, to] as const,
};

export function useLeaveRequests(filters?: LeaveRequestFilters) {
  return useQuery({
    queryKey: LEAVE_KEYS.requests(filters),
    queryFn: () => listLeaveRequests(filters),
  });
}

export function useLeaveBalances(filters?: LeaveBalanceFilters) {
  return useQuery({
    queryKey: LEAVE_KEYS.balances(filters),
    queryFn: () => listLeaveBalances(filters),
  });
}

export function useLeaveCalendar(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: LEAVE_KEYS.calendar(from, to),
    queryFn: () => listLeaveCalendar(from, to),
    enabled,
  });
}

/** Ghi nhận, duyệt, từ chối, rút lại đơn nghỉ. */
export function useLeaveRequestMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: LEAVE_KEYS.root });
  };

  const create = useMutation({
    mutationFn: (payload: CreateLeaveRequestPayload) =>
      createLeaveRequest(payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: UpdateLeaveRequestPayload;
    }) => updateLeaveRequest(id, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteLeaveRequest(id),
    onSuccess: invalidate,
  });

  const approve = useMutation({
    mutationFn: (id: number) => approveLeaveRequest(id),
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      rejectLeaveRequest(id, reason),
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: (id: number) => cancelLeaveRequest(id),
    onSuccess: invalidate,
  });

  return {
    createRequest: create.mutateAsync,
    updateRequest: update.mutateAsync,
    deleteRequest: remove.mutateAsync,
    approveRequest: approve.mutateAsync,
    rejectRequest: reject.mutateAsync,
    cancelRequest: cancel.mutateAsync,
    isCreating: create.isPending,
    isUpdating: update.isPending,
    isDeleting: remove.isPending,
    isApproving: approve.isPending,
    isRejecting: reject.isPending,
    isCancelling: cancel.isPending,
  };
}

/**
 * Cấp và điều chỉnh quỹ phép.
 *
 * `preview` chạy `dryRun` để người dùng thấy trước sẽ tạo bao nhiêu, bỏ qua bao
 * nhiêu; `commit` mới ghi thật. Chỉ `commit` làm mới cache — một lần tính thử
 * không đổi gì trên server nên không có gì để làm mới.
 */
export function useLeaveBalanceMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: LEAVE_KEYS.root });
  };

  const preview = useMutation({
    mutationFn: (payload: InitLeaveBalancePayload) =>
      initLeaveBalances({ ...payload, dryRun: true }),
  });

  const commit = useMutation({
    mutationFn: (payload: InitLeaveBalancePayload) =>
      initLeaveBalances({ ...payload, dryRun: false }),
    onSuccess: invalidate,
  });

  const adjust = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: AdjustLeaveBalancePayload;
    }) => adjustLeaveBalance(id, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteLeaveBalance(id),
    onSuccess: invalidate,
  });

  return {
    deleteBalance: remove.mutateAsync,
    isDeleting: remove.isPending,
    previewInit: preview.mutateAsync,
    commitInit: commit.mutateAsync,
    adjustBalance: adjust.mutateAsync,
    isPreviewing: preview.isPending,
    isCommitting: commit.isPending,
    isAdjusting: adjust.isPending,
  };
}
