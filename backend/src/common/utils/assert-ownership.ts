import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Các role được phép truy cập hồ sơ của nhân viên khác
 * (docs/architecture.md §7.3 – nhóm "Tất cả nhân viên").
 *
 * Lưu ý: role `manager` KHÔNG nằm trong danh sách này. Theo ma trận quyền,
 * manager chỉ xem được nhân viên **trong phòng ban của mình** – việc đó cần
 * biết department của resource nên sẽ được kiểm tra ở tầng service của từng
 * module (Giai đoạn 3), không thể quyết định chỉ bằng role. Nếu một endpoint
 * cần cho manager đi qua, truyền `privilegedRoles` tường minh.
 */
export const EMPLOYEE_RECORD_PRIVILEGED_ROLES: readonly string[] = [
  'admin',
  'hr_manager',
  'hr_staff',
];

export interface AssertOwnershipOptions {
  /** Tên resource, chỉ dùng cho message log. Mặc định `resource`. */
  resource?: string;
  /** Ghi đè danh sách role được bỏ qua kiểm tra ownership. */
  privilegedRoles?: readonly string[];
}

/**
 * Đảm bảo resource thuộc về user đang đăng nhập, nếu không thì ném
 * `403 FORBIDDEN`.
 *
 * Quy tắc:
 *  - Chưa đăng nhập (`user` undefined) → 403 (JwtAuthGuard lẽ ra đã chặn từ
 *    trước, đây là lớp phòng vệ thứ 2 – fail closed).
 *  - Role nằm trong `privilegedRoles` → cho qua, không cần so khớp.
 *  - `ownerEmployeeId` null/undefined → 403 (resource không xác định được chủ
 *    sở hữu thì không ai "sở hữu" nó ngoài role đặc quyền).
 *  - User chưa liên kết hồ sơ nhân viên (`employeeId` null) → 403.
 *  - So khớp `Number(user.employeeId) === Number(ownerEmployeeId)` (cột bigint
 *    của MySQL được driver trả về dạng string nên phải ép kiểu).
 */
export function assertOwnership(
  user: AuthenticatedUser | undefined | null,
  ownerEmployeeId: number | string | null | undefined,
  options: AssertOwnershipOptions = {},
): void {
  const resource = options.resource ?? 'resource';
  const privilegedRoles =
    options.privilegedRoles ?? EMPLOYEE_RECORD_PRIVILEGED_ROLES;

  if (!user) {
    throw forbidden(`Anonymous request cannot access ${resource}`);
  }

  if (privilegedRoles.includes(user.role)) {
    return;
  }

  if (ownerEmployeeId === null || ownerEmployeeId === undefined) {
    throw forbidden(
      `Role "${user.role}" cannot access ${resource} without an owner`,
    );
  }

  if (user.employeeId === null || user.employeeId === undefined) {
    throw forbidden(
      `User ${user.userId} has no employee profile and cannot access ${resource}`,
    );
  }

  if (Number(user.employeeId) !== Number(ownerEmployeeId)) {
    throw forbidden(
      `User ${user.userId} (employee ${user.employeeId}) cannot access ${resource} owned by employee ${ownerEmployeeId}`,
    );
  }
}

/** Kiểm tra không ném lỗi – dùng khi cần rẽ nhánh thay vì chặn. */
export function isOwnerOrPrivileged(
  user: AuthenticatedUser | undefined | null,
  ownerEmployeeId: number | string | null | undefined,
  options: AssertOwnershipOptions = {},
): boolean {
  try {
    assertOwnership(user, ownerEmployeeId, options);
    return true;
  } catch {
    return false;
  }
}

function forbidden(message: string): ForbiddenException {
  return new ForbiddenException({ code: 'FORBIDDEN', message });
}
