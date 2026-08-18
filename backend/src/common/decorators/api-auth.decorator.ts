import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';

/** Tên security scheme khai báo trong main.ts (DocumentBuilder.addBearerAuth). */
export const SWAGGER_BEARER_AUTH_NAME = 'access-token';

/**
 * Shortcut Swagger cho endpoint cần đăng nhập (docs/architecture.md §6.5):
 * gắn Bearer auth + document sẵn response 401.
 */
export const ApiAuth = () =>
  applyDecorators(
    ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME),
    ApiUnauthorizedResponse({
      description:
        'Thiếu/không hợp lệ access token (TOKEN_INVALID) hoặc token hết hạn (TOKEN_EXPIRED)',
    }),
  );
