import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserPayload {
  userId: number;
  username: string;
  role: string;
  employeeId?: number | null;
}

interface RequestWithUser {
  user?: CurrentUserPayload;
}

/**
 * Lấy user hiện tại từ request (được JwtAuthGuard gán vào req.user).
 * Sẽ được dùng ở các phase sau khi có auth thực sự.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    return data && user ? user[data] : user;
  },
);
