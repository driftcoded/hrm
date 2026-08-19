/** `roles.name` values for the 5 seeded roles (docs/database-schema.md §1.1). */
export const ROLE_ADMIN = 'admin';
export const ROLE_HR_MANAGER = 'hr_manager';
export const ROLE_HR_STAFF = 'hr_staff';
export const ROLE_MANAGER = 'manager';
export const ROLE_EMPLOYEE = 'employee';

/**
 * Roles allowed to CREATE/UPDATE/DELETE master data (departments, positions,
 * leave types, holidays) — as required by PLAN Phase 2.1.
 *
 * GET on master data does NOT declare `@Roles()`: any authenticated role can
 * read it (JwtAuthGuard still blocks requests without a token).
 *
 * ⚠️ api-spec.md §4/§5 lists `Roles: admin, hr_manager` for POST/PATCH/DELETE
 * (missing `hr_staff`). PLAN 2.1 is the source of truth here; see the Phase
 * 2.1 report.
 */
export const MASTER_DATA_WRITE_ROLES: string[] = [
  ROLE_ADMIN,
  ROLE_HR_MANAGER,
  ROLE_HR_STAFF,
];

/**
 * Roles allowed to CREATE/UPDATE employee records (api-spec.md §3 –
 * POST/PATCH `/employees`, §10 – family members).
 */
export const EMPLOYEE_WRITE_ROLES: string[] = [
  ROLE_ADMIN,
  ROLE_HR_MANAGER,
  ROLE_HR_STAFF,
];

/**
 * Roles allowed to SOFT-DELETE / RESTORE employee records.
 * Narrower than `EMPLOYEE_WRITE_ROLES` — api-spec.md §3 states that DELETE
 * `/employees/:id` is limited to `admin`, `hr_manager` (hr_staff can enter
 * data but cannot delete).
 */
export const EMPLOYEE_DELETE_ROLES: string[] = [ROLE_ADMIN, ROLE_HR_MANAGER];

/** Roles allowed to read any employee list/record (api-spec.md §3). */
export const EMPLOYEE_READ_ROLES: string[] = [
  ROLE_ADMIN,
  ROLE_HR_MANAGER,
  ROLE_HR_STAFF,
];

/**
 * Labor contracts: GET is available to the HR group, writes are limited to
 * `admin`/`hr_manager` (api-spec.md §6 – POST/PATCH `/contracts`).
 */
export const CONTRACT_READ_ROLES: string[] = EMPLOYEE_READ_ROLES;
export const CONTRACT_WRITE_ROLES: string[] = [ROLE_ADMIN, ROLE_HR_MANAGER];

/**
 * Vai trò được ĐĂNG NHẬP vào hệ thống quản trị này.
 *
 * `employee` KHÔNG có mặt: đây là công cụ vận hành của bộ phận quản lý, nhân
 * sự, kế toán và IT. Nhân viên thường sẽ có một cổng riêng ("MyPage") để tra
 * cứu thông tin của mình — cổng đó là một ứng dụng khác, chưa xây.
 *
 * Chặn ngay tại bước đăng nhập chứ không chỉ ẩn menu: một tài khoản không được
 * phép vào thì không nên có phiên làm việc, access token, hay bản ghi
 * `refresh_tokens` trong hệ thống này. Ẩn giao diện mà vẫn phát token là để
 * quyền truy cập thật nằm sau một lớp trang trí.
 */
export const PORTAL_LOGIN_ROLES: string[] = [
  ROLE_ADMIN,
  ROLE_HR_MANAGER,
  ROLE_HR_STAFF,
  ROLE_MANAGER,
];

/**
 * Vai trò được GHI NHẬN đơn nghỉ phép cho nhân viên.
 *
 * Nhân viên không đăng nhập hệ thống này nên không ai tự nộp đơn: quản lý ghi
 * cho phòng mình (`resolveScope` giới hạn phạm vi), nhân sự ghi cho bất kỳ ai.
 */
export const LEAVE_RECORD_ROLES: string[] = [
  ROLE_ADMIN,
  ROLE_HR_MANAGER,
  ROLE_HR_STAFF,
  ROLE_MANAGER,
];

/**
 * Vai trò được DUYỆT đơn nghỉ phép — nhân sự.
 *
 * Hẹp hơn `LEAVE_RECORD_ROLES`: `manager` ghi nhận nhưng KHÔNG duyệt. Ngày nghỉ
 * phép trừ vào quỹ và ảnh hưởng tới lương, nên bước duyệt là lớp kiểm soát cuối
 * cùng. Service còn chặn thêm người vừa ghi vừa duyệt chính đơn đó.
 */
export const LEAVE_APPROVE_ROLES: string[] = [
  ROLE_ADMIN,
  ROLE_HR_MANAGER,
  ROLE_HR_STAFF,
];

/**
 * Vai trò được XEM bảng lương.
 *
 * HẸP HƠN MỌI QUYỀN ĐỌC KHÁC trong hệ thống. `manager` đọc được hồ sơ và chấm
 * công của phòng mình, nhưng lương thì không: biết lương của nhân viên dưới
 * quyền không cần thiết cho việc quản lý công việc, và một bảng lương lộ ra nội
 * bộ là chuyện không thu lại được.
 */
export const PAYROLL_READ_ROLES: string[] = [
  ROLE_ADMIN,
  ROLE_HR_MANAGER,
  ROLE_HR_STAFF,
];

/**
 * Vai trò được TÍNH, SỬA và DUYỆT bảng lương.
 *
 * `hr_staff` xem được nhưng KHÔNG duyệt: duyệt bảng lương là chốt số tiền công
 * ty chi ra trong tháng, và đó là bước kiểm soát cuối cùng trước khi tiền đi.
 */
export const PAYROLL_WRITE_ROLES: string[] = [ROLE_ADMIN, ROLE_HR_MANAGER];

/**
 * Vai trò được GHI NHẬN phiếu tạm ứng lương.
 *
 * Cùng khuôn với đơn nghỉ phép: quản lý ghi cho phòng mình, nhân sự ghi cho bất
 * kỳ ai — nhân viên không đăng nhập hệ thống này nên không ai tự đề nghị.
 */
export const ADVANCE_RECORD_ROLES: string[] = [
  ROLE_ADMIN,
  ROLE_HR_MANAGER,
  ROLE_HR_STAFF,
  ROLE_MANAGER,
];

/** Vai trò được DUYỆT phiếu tạm ứng — tiền ra khỏi công ty, hẹp hơn người ghi. */
export const ADVANCE_APPROVE_ROLES: string[] = [ROLE_ADMIN, ROLE_HR_MANAGER];
