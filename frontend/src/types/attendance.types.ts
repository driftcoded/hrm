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
   * Giờ làm thêm, suy ra từ chính giờ vào/ra: phần vượt 8 giờ/ngày, hoặc toàn
   * bộ thời gian làm nếu là ngày nghỉ tuần/ngày lễ.
   *
   * ĐÂY LÀ CĂN CỨ TRẢ TIỀN. Không có bảng đơn đăng ký/duyệt song song — hệ số
   * Điều 98 và phụ trội ca đêm 22h–6h do backend áp lúc tính lương
   * (business-rules.md §7.1, §12.3).
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
