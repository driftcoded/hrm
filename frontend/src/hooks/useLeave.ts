import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
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
import { LEAVE_STATUSES } from '@/types/leave.types';
import type {
  AdjustLeaveBalancePayload,
  CreateLeaveRequestPayload,
  InitLeaveBalancePayload,
  LeaveBalanceFilters,
  LeaveRequestFilters,
  LeaveStatus,
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

/**
 * Phạm vi đếm của `useLeaveRequestStats` — CỐ TÌNH không có `status`.
 *
 * Thẻ thống kê chính là bảng phân tích theo trạng thái, nên nó phải đếm trên
 * cùng một phạm vi bất kể người dùng đang lọc trạng thái nào. Nếu để `status`
 * lọt vào đây thì lọc "Chờ duyệt" sẽ làm ba thẻ còn lại về 0 — hàng thẻ tự phủ
 * định chính nó.
 */
export type LeaveRequestStatsFilters = Pick<
  LeaveRequestFilters,
  'employeeId' | 'departmentId' | 'leaveTypeId' | 'from' | 'to'
>;

export interface LeaveRequestStats extends Record<LeaveStatus, number> {
  total: number;
}

/**
 * Đếm đơn nghỉ theo trạng thái trong phạm vi đang lọc.
 *
 * Backend chưa có endpoint tổng hợp, nên đây là bốn truy vấn `limit: 1` chạy
 * song song, chỉ đọc `meta.total` — KHÔNG phải tải hết đơn về rồi đếm ở client.
 * Đếm trên `items` của bảng thì chỉ ra được số của TRANG hiện tại, một con số
 * trông như tổng nhưng đổi theo mỗi lần bấm sang trang.
 *
 * Query key nằm dưới `LEAVE_KEYS.requests` nên `invalidateQueries(root)` sau mỗi
 * lần duyệt/từ chối/xoá làm mới luôn các thẻ — số trên thẻ không bao giờ cũ hơn
 * bảng ngay dưới nó.
 *
 * Khi backend có `GET /leave-requests/stats`, thay ruột hàm này là xong; màn
 * hình không phải sửa gì.
 */
export function useLeaveRequestStats(filters: LeaveRequestStatsFilters) {
  const results = useQueries({
    queries: LEAVE_STATUSES.map((status) => {
      const query: LeaveRequestFilters = { ...filters, status, page: 1, limit: 1 };
      return {
        queryKey: LEAVE_KEYS.requests(query),
        queryFn: () => listLeaveRequests(query),
      };
    }),
  });

  const isLoading = results.some((result) => result.isLoading);
  const isError = results.some((result) => result.isError);

  let data: LeaveRequestStats | undefined;

  if (!isLoading && !isError) {
    const counts = {} as Record<LeaveStatus, number>;
    let total = 0;

    LEAVE_STATUSES.forEach((status, index) => {
      const count = results[index].data?.meta.total ?? 0;
      counts[status] = count;
      total += count;
    });

    data = { ...counts, total };
  }

  return {
    data,
    isLoading,
    isError,
    refetch: () => {
      results.forEach((result) => void result.refetch());
    },
  };
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
