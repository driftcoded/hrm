import type { UserRole } from '@/types/auth.types';

/**
 * Role capability lists — one place, so no component ever compares role strings
 * inline.
 *
 * `MASTER_DATA_WRITE_ROLES` mirrors the backend's
 * `src/common/constants/roles.constant.ts`. Keep the two in sync: a role listed
 * here but not there gets buttons that 403, and a role listed there but not here
 * loses controls it is allowed to use.
 */
export const MASTER_DATA_WRITE_ROLES: readonly UserRole[] = ['admin', 'hr_manager', 'hr_staff'];

/**
 * Vai trò được TẠO/SỬA hồ sơ nhân viên — mirrors the backend's
 * `EMPLOYEE_WRITE_ROLES`.
 */
export const EMPLOYEE_WRITE_ROLES: readonly UserRole[] = ['admin', 'hr_manager', 'hr_staff'];

/**
 * Vai trò được XOÁ MỀM / KHÔI PHỤC hồ sơ — narrower than write on purpose,
 * mirroring the backend: `hr_staff` enters data but may not delete it.
 */
export const EMPLOYEE_DELETE_ROLES: readonly UserRole[] = ['admin', 'hr_manager'];

/** Hợp đồng lao động: only `admin` / `hr_manager` may sign or end one. */
export const CONTRACT_WRITE_ROLES: readonly UserRole[] = ['admin', 'hr_manager'];

/** Tạo tài khoản đăng nhập (`POST /users`) — admin only. */
export const USER_WRITE_ROLES: readonly UserRole[] = ['admin'];

/**
 * Cấu hình thương hiệu (logo/tên công ty) và SMTP (`/settings/branding`,
 * `/settings/mail`) — admin only, hẹp hơn `MASTER_DATA_WRITE_ROLES`. Đây là
 * cấu hình TOÀN HỆ THỐNG (SMTP còn chứa mật khẩu, dù đã mã hoá), không phải
 * danh mục nghiệp vụ như phòng ban/chức vụ nên không dùng chung hằng đó.
 */
export const SETTINGS_WRITE_ROLES: readonly UserRole[] = ['admin'];

/**
 * Vai trò được XUẤT danh sách nhân viên ra Excel — mirrors the backend's
 * `EMPLOYEE_EXPORT_ROLES` in `modules/reports/employee-export.service.ts`.
 *
 * `manager` KHÔNG có mặt dù trưởng phòng vẫn xem được danh sách phòng mình
 * trên màn hình: xem từng dòng và rút cả bảng ra một file rời khỏi hệ thống là
 * hai việc khác nhau. Đây là một hằng riêng chứ không dùng lại
 * `EMPLOYEE_WRITE_ROLES` — nới quyền xem sau này không được phép âm thầm nới
 * luôn quyền xuất file.
 */
export const EMPLOYEE_EXPORT_ROLES: readonly UserRole[] = ['admin', 'hr_manager', 'hr_staff'];

/**
 * Vai trò XEM ĐƯỢC bảng chấm công toàn công ty (`GET /attendances`).
 *
 * `manager` có mặt nhưng backend giới hạn họ trong phòng ban mình quản
 * (`resolveScope`); nhân viên thường nhận 403 và phải dùng `/attendances/me`.
 */
export const ATTENDANCE_READ_ALL_ROLES: readonly UserRole[] = [
  'admin',
  'hr_manager',
  'hr_staff',
  'manager',
];

/**
 * Vai trò SỬA bảng chấm công và NẠP FILE — mirrors backend `EMPLOYEE_WRITE_ROLES`.
 *
 * Hẹp hơn danh sách đọc: `manager` đọc được phòng mình nhưng không sửa. Sửa
 * bảng chấm công là sửa căn cứ trả lương, để trưởng phòng tự sửa giờ cho nhân
 * viên phòng mình là bỏ lớp kiểm soát duy nhất của việc đó.
 */
export const ATTENDANCE_WRITE_ROLES: readonly UserRole[] = [
  'admin',
  'hr_manager',
  'hr_staff',
];

/** Vai trò xuất bảng chấm công — mirrors `AttendanceExportService.EXPORT_ROLES`. */
export const ATTENDANCE_EXPORT_ROLES: readonly UserRole[] = ATTENDANCE_READ_ALL_ROLES;

/**
 * Vai trò được GHI NHẬN giờ làm thêm cho nhân viên — mirrors backend
 * `OVERTIME_RECORD_ROLES`.
 *
 * Nhân viên không đăng nhập hệ thống này nên không ai tự đăng ký: quản lý ghi
 * cho phòng mình, nhân sự ghi cho bất kỳ ai.
 */
export const OVERTIME_RECORD_ROLES: readonly UserRole[] = [
  'admin',
  'hr_manager',
  'hr_staff',
  'manager',
];

/**
 * Vai trò được DUYỆT giờ làm thêm — kế toán/nhân sự, mirrors backend
 * `OVERTIME_APPROVE_ROLES`.
 *
 * `manager` ghi nhận nhưng KHÔNG duyệt: giờ làm thêm là tiền ra khỏi công ty và
 * bước duyệt là lớp kiểm soát duy nhất trước bảng lương. Backend còn chặn thêm
 * người vừa ghi vừa duyệt chính đơn đó — giao diện không đoán được điều này nên
 * vẫn hiện nút, và lỗi trả về được dịch thành câu rõ ràng.
 */
export const OVERTIME_APPROVE_ROLES: readonly UserRole[] = [
  'admin',
  'hr_manager',
  'hr_staff',
];
