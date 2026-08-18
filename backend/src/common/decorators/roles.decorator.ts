import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Khai báo roles được phép truy cập endpoint/controller.
 * Dùng cùng với RolesGuard (sẽ triển khai đầy đủ ở phase auth).
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
