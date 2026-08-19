/** Khớp `AttendanceStatus` ở backend (business-rules.md §12.4). */
export const ATTENDANCE_STATUSES = [
  'present',
  'absent',
  'late',
  'early_leave',
  'leave',
  'holiday',
  'wfh',
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_SORT_KEYS = ['workDate', 'checkIn', 'workHours'] as const;

export type AttendanceSortKey = (typeof ATTENDANCE_SORT_KEYS)[number];

export interface AttendanceEmployee {
  id: number;
  employeeCode: string;
  fullName: string;
  departmentName: string | null;
}

export interface AttendanceRecord {
  id: number;
  employeeId: number;
  employee: AttendanceEmployee | null;
  /** `YYYY-MM-DD`. */
  workDate: string;
  /** `HH:mm`, `null` khi chưa chấm vào. */
  checkIn: string | null;
  checkOut: string | null;
  /**
   * Giờ nghỉ thực tế của ngày công. `null` khi bản ghi không có — khi đó giờ
   * công đã được tính theo khung nghỉ chuẩn của công ty.
   */
  breakStart: string | null;
  breakEnd: string | null;
  /** `null` khi chưa chấm ra — KHÔNG phải 0. */
  workHours: number | null;
  /**
   * Số giờ đã ở lại làm vượt ngày công chuẩn.
   *
   * ⚠️ KHÔNG phải số giờ được trả tiền làm thêm. Tiền tính theo đơn đã duyệt ở
   * `/overtime-requests` — xem `AttendanceSummary.approvedOvertimeHours`.
   */
  overtimeHours: number;
  isLate: boolean;
  lateMinutes: number;
  isEarlyLeave: boolean;
  earlyLeaveMinutes: number;
  status: AttendanceStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceFilters {
  page?: number;
  limit?: number;
  sort?: AttendanceSortKey;
  order?: 'asc' | 'desc';
  employeeId?: number;
  departmentId?: number;
  month?: number;
  year?: number;
  status?: AttendanceStatus;
}

/**
 * Nhập tay MỘT ngày công.
 *
 * Hệ thống không có chức năng tự chấm công — dữ liệu đến từ nền tảng ngoài,
 * vào bằng Excel hoặc gõ tay qua form này cho những ca lẻ file không có.
 */
export interface CreateAttendancePayload {
  employeeId: number;
  workDate: string;
  /** Tuỳ chọn: ngày nghỉ phép/ngày lễ vẫn là một dòng, chỉ là không có giờ vào. */
  checkIn?: string;
  checkOut?: string;
  /** Bỏ trống thì trừ theo khung nghỉ chuẩn của công ty. */
  breakStart?: string;
  breakEnd?: string;
  status?: AttendanceStatus;
  note?: string;
}

export interface UpdateAttendancePayload {
  checkIn?: string;
  checkOut?: string;
  breakStart?: string;
  breakEnd?: string;
  status?: AttendanceStatus;
  /** BẮT BUỘC — bản ghi phải tự nói được vì sao nó khác thứ máy đã ghi. */
  note: string;
}

// ------------------------------------------------------------- import ----

export interface AttendanceImportError {
  /** Số dòng trong FILE EXCEL (dòng 1 là tiêu đề). */
  row: number;
  employeeCode: string | null;
  code: string;
  /** Tiếng Việt, do backend sinh — chuỗi này ĐƯỢC hiển thị cho người dùng. */
  message: string;
}

export interface AttendanceImportResult {
  dryRun: boolean;
  totalRows: number;
  created: number;
  /** Số bản ghi GHI ĐÈ lên ngày công đã có. */
  updated: number;
  /** Rỗng = file hợp lệ. Có phần tử = KHÔNG dòng nào được ghi. */
  errors: AttendanceImportError[];
}

// ----------------------------------------------------------- overtime ----

export const OVERTIME_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
] as const;

export type OvertimeStatus = (typeof OVERTIME_STATUSES)[number];

export const OVERTIME_RATE_TYPES = ['weekday', 'weekend', 'holiday'] as const;

export type OvertimeRateType = (typeof OVERTIME_RATE_TYPES)[number];

export const OVERTIME_SORT_KEYS = ['workDate', 'createdAt', 'totalHours'] as const;

export type OvertimeSortKey = (typeof OVERTIME_SORT_KEYS)[number];

export interface OvertimeRequest {
  id: number;
  employeeId: number;
  employee: AttendanceEmployee | null;
  workDate: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  /** Phần giờ rơi vào khung 22h–6h. */
  nightHours: number;
  rateType: OvertimeRateType;
  /** Hệ số Điều 98 đã chốt lúc tạo đơn. */
  rate: number;
  nightRateSurcharge: number;
  reason: string;
  /** Người GHI NHẬN đơn (quản lý/nhân sự nhập hộ). `null` với đơn cũ. */
  recordedBy: number | null;
  recorderName: string | null;
  status: OvertimeStatus;
  approvedBy: number | null;
  approverName: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OvertimeFilters {
  page?: number;
  limit?: number;
  sort?: OvertimeSortKey;
  order?: 'asc' | 'desc';
  employeeId?: number;
  departmentId?: number;
  status?: OvertimeStatus;
  month?: number;
  year?: number;
}

export interface CreateOvertimePayload {
  /** Nhân viên ĐƯỢC hưởng giờ làm thêm — không phải người đang đăng nhập. */
  employeeId: number;
  workDate: string;
  startTime: string;
  endTime: string;
  reason: string;
}
