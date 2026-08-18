import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../types/authenticated-user';

interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

/**
 * Guard global chạy SAU JwtAuthGuard (docs/architecture.md §6.2).
 * Đọc metadata từ `@Roles(...)` và so với `req.user.role` (roles.name).
 * Endpoint không khai báo `@Roles()` → cho qua (chỉ cần đăng nhập).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Requires one of roles: ${requiredRoles.join(', ')}`,
      });
    }

    return true;
  }
}
