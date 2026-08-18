import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Giữ tên cũ (phase 0) làm alias để không phá code đã import.
 * Định nghĩa canonical nằm ở `common/types/authenticated-user.ts`.
 */
export type CurrentUserPayload = AuthenticatedUser;

interface RequestWithUser {
  user?: AuthenticatedUser;
}

/**
 * Lấy user hiện tại từ request (được JwtAuthGuard gán vào req.user).
 * Dùng `@CurrentUser()` để lấy cả object, `@CurrentUser('userId')` để lấy 1 field.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    return data && user ? user[data] : user;
  },
);
