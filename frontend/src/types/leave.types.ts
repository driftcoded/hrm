/** Khớp `LeaveRequestStatus` ở backend — cùng vòng đời đơn từ với chấm công. */
export const LEAVE_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
] as const;

export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

/** Nghỉ nửa ngày ở đầu/cuối kỳ. */
export const LEAVE_HALVES = ['full', 'morning', 'afternoon'] as const;

export type LeaveHalf = (typeof LEAVE_HALVES)[number];

export const LEAVE_REQUEST_SORT_KEYS = [
  'startDate',
  'createdAt',
  'totalDays',
] as const;

export type LeaveRequestSortKey = (typeof LEAVE_REQUEST_SORT_KEYS)[number];

export const LEAVE_BALANCE_SORT_KEYS = ['year', 'remainingDays'] as const;

export type LeaveBalanceSortKey = (typeof LEAVE_BALANCE_SORT_KEYS)[number];

export interface LeaveEmployee {
  id: number;
  employeeCode: string;
  fullName: string;
  departmentName: string | null;
}

export interface LeaveTypeRef {
  id: number;
  code: string;
  name: string;
  isPaid: boolean;
}

// ------------------------------------------------------------- quỹ phép ----

export interface LeaveBalance {
  id: number;
  employeeId: number;
  employee: LeaveEmployee | null;
  leaveType: Pick<LeaveTypeRef, 'id' | 'code' | 'name'> | null;
  year: number;
  allocatedDays: number;
  carriedOver: number;
  /** Từ các đơn ĐÃ DUYỆT. */
  usedDays: number;
  /** Đang chờ duyệt — đã giữ chỗ nhưng chưa trừ hẳn. */
  pendingDays: number;
  /**
   * Cột VIRTUAL của DB: `allocated + carriedOver − used − pending`.
   * Chỉ đọc — không gửi lên được.
   */
  remainingDays: number;
  updatedAt: string;
}

export interface LeaveBalanceFilters {
  page?: number;
  limit?: number;
  sort?: LeaveBalanceSortKey;
  order?: 'asc' | 'desc';
  employeeId?: number;
  departmentId?: number;
  leaveTypeId?: number;
  year?: number;
}

export interface InitLeaveBalancePayload {
  year: number;
  /** `true` = chỉ tính thử, không ghi gì. */
  dryRun?: boolean;
  /** `true` = cộng số ngày còn lại của năm trước vào `carriedOver`. */
  carryOver?: boolean;
}

export interface InitLeaveBalanceResult {
  dryRun: boolean;
  year: number;
  employeesConsidered: number;
  created: number;
  /** Đã có quỹ năm này nên bị bỏ qua — KHÔNG ghi đè. */
  skipped: number;
}

export interface AdjustLeaveBalancePayload {
  allocatedDays?: number;
  carriedOver?: number;
  /** BẮT BUỘC — quỹ phép là quyền lợi, mọi thay đổi thủ công phải nói được vì sao. */
  reason: string;
}

// -------------------------------------------------------------- đơn nghỉ ----

export interface LeaveRequest {
  id: number;
  employeeId: number;
  employee: LeaveEmployee | null;
  leaveType: LeaveTypeRef | null;
  startDate: string;
  endDate: string;
  startHalf: LeaveHalf;
  endHalf: LeaveHalf;
  /** Số ngày phép bị trừ — do server tính, chỉ đếm ngày làm việc. */
  totalDays: number;
  reason: string;
  /** Người GHI NHẬN đơn. `null` với đơn tạo trước khi có cột này. */
  recordedBy: number | null;
  recorderName: string | null;
  status: LeaveStatus;
  approvedBy: number | null;
  approverName: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  attachmentUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRequestFilters {
  page?: number;
  limit?: number;
  sort?: LeaveRequestSortKey;
  order?: 'asc' | 'desc';
  employeeId?: number;
  departmentId?: number;
  leaveTypeId?: number;
  status?: LeaveStatus;
  /** Lọc theo kỳ nghỉ GIAO NHAU với khoảng, không phải chỉ đơn bắt đầu trong khoảng. */
  from?: string;
  to?: string;
}

export interface CreateLeaveRequestPayload {
  /** Nhân viên ĐƯỢC nghỉ — không phải người đang đăng nhập. */
  employeeId: number;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  startHalf?: LeaveHalf;
  endHalf?: LeaveHalf;
  reason: string;
}

/**
 * Body sửa đơn.
 *
 * KHÔNG có `employeeId`: backend từ chối đổi người được nghỉ, vì quỹ phép và
 * kiểm tra trùng ngày đều tính theo nhân viên. Nhập nhầm người thì xoá và ghi
 * lại.
 */
export type UpdateLeaveRequestPayload = Partial<
  Omit<CreateLeaveRequestPayload, 'employeeId'>
>;

/**
 * Kết quả xoá đơn.
 *
 * `attendanceDaysKept` là những dòng chấm công của đơn này nhưng ĐÃ BỊ SỬA sang
 * trạng thái khác nên được giữ lại — dữ liệu công thật, không phải hệ quả của
 * đơn nữa. Khác 0 thì phải nói cho người xoá biết.
 */
export interface DeleteLeaveResult {
  id: number;
  deleted: boolean;
  attendanceDaysRemoved: number;
  attendanceDaysKept: number;
}

/**
 * Kết quả duyệt đơn.
 *
 * `attendanceConflicts` là những ngày ĐÃ CÓ dữ liệu chấm công nên không bị ghi
 * đè. Phải hiện cho người duyệt thấy: vừa có giờ chấm vừa được duyệt nghỉ trong
 * cùng một ngày là mâu thuẫn cần người xem xử lý.
 */
export interface ApproveLeaveResult {
  request: LeaveRequest;
  attendanceDaysWritten: number;
  attendanceConflicts: string[];
}
