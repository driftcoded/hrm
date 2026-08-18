import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Declares which roles are allowed to access an endpoint/controller.
 * Used together with RolesGuard (fully implemented in the auth phase).
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
