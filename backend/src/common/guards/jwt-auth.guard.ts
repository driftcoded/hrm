import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  AccessTokenPayload,
  AuthenticatedUser,
} from '../types/authenticated-user';

interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

/**
 * Guard global (đăng ký qua APP_GUARD trong AppModule) – chạy TRƯỚC RolesGuard.
 *
 * - Bỏ qua khi handler/controller có `@Public()`.
 * - Verify `Authorization: Bearer <access_token>` → gán `req.user`.
 * - Không có token / token sai → 401 TOKEN_INVALID; token hết hạn → 401 TOKEN_EXPIRED
 *   (api-spec.md §21) để frontend biết khi nào cần gọi `/auth/refresh`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Missing Bearer access token',
      });
    }

    try {
      const payload =
        await this.jwtService.verifyAsync<AccessTokenPayload>(token);

      request.user = {
        userId: Number(payload.sub),
        username: payload.username,
        role: payload.role,
        employeeId:
          payload.employeeId === null || payload.employeeId === undefined
            ? null
            : Number(payload.employeeId),
        sessionId:
          payload.sid === null || payload.sid === undefined
            ? null
            : Number(payload.sid),
      };

      return true;
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedException({
          code: 'TOKEN_EXPIRED',
          message: 'Access token has expired',
        });
      }

      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Access token is invalid',
      });
    }
  }
}

function extractBearerToken(request: Request): string | undefined {
  const header = request.headers.authorization;
  if (!header) {
    return undefined;
  }

  const [scheme, value] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value) {
    return undefined;
  }

  return value.trim();
}
