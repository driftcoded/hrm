import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CookieOptions, Request, Response } from 'express';
import { AuthConfig } from '@/config/auth.config';

@Injectable()
export class RefreshCookieService {
  constructor(private readonly configService: ConfigService) {}

  get cookieName(): string {
    return this.configService.getOrThrow<AuthConfig>('auth').refreshCookieName;
  }

  /**
   * Path DUY NHẤT của cookie refresh token: chỉ endpoint refresh mới nhận được.
   *
   * Vì sao không dùng `/`: với `path=/` browser gắn refresh token vào MỌI request
   * tới origin (kể cả request tải ảnh/tài liệu), tăng vô ích bề mặt bị lộ. Refresh
   * token chỉ cần thiết ở đúng `POST /<prefix>/auth/refresh`.
   *
   * Path được tính từ `API_PREFIX` (config, không hardcode) và được normalize để
   * không bị thiếu/lặp dấu `/` khi API_PREFIX được khai báo dạng `api/v1`,
   * `/api/v1` hay `/api/v1/`.
   */
  get cookiePath(): string {
    const apiPrefix = this.configService.get<string>('app.apiPrefix', 'api/v1');
    const normalizedPrefix = apiPrefix.replace(/^\/+|\/+$/g, '');

    return normalizedPrefix.length > 0
      ? `/${normalizedPrefix}/auth/refresh`
      : '/auth/refresh';
  }

  /** Đọc refresh token từ cookie (không bao giờ lấy từ body – xem AuthController). */
  read(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, string> | undefined;
    const value = cookies?.[this.cookieName];
    return value && value.length > 0 ? value : undefined;
  }

  /**
   * @param persistent `true` (rememberMe) → cookie có maxAge = tuổi thọ refresh
   * token; `false` → session cookie (không maxAge/expires → mất khi đóng browser).
   */
  set(
    response: Response,
    token: string,
    persistent: boolean,
    maxAgeMs: number,
  ): void {
    const options = this.baseOptions();

    if (persistent) {
      options.maxAge = maxAgeMs;
    }

    response.cookie(this.cookieName, token, options);
  }

  clear(response: Response): void {
    response.clearCookie(this.cookieName, this.baseOptions());
  }

  /**
   * ⚠️ `secure` PHẢI phụ thuộc môi trường:
   * `Secure: true` trên `http://localhost` khiến browser **âm thầm bỏ cookie**
   * (không có lỗi nào hiện ra) → dev sẽ không bao giờ refresh được token.
   * Vì vậy: production → true (bắt buộc HTTPS), dev/test → false.
   * `httpOnly` và `sameSite: 'strict'` luôn bật ở mọi môi trường (chống XSS/CSRF).
   *
   * ⚠️ `set()` và `clear()` PHẢI dùng CHUNG hàm này: `clearCookie` chỉ xoá được
   * cookie khi các attribute định danh (đặc biệt là `Path`, cùng domain/secure/
   * sameSite scope) khớp với lúc set. Nếu path của 2 bên lệch nhau, logout sẽ
   * "thành công" nhưng cookie vẫn còn trong browser.
   */
  private baseOptions(): CookieOptions {
    const isProduction =
      this.configService.get<string>('app.nodeEnv') === 'production';

    return {
      httpOnly: true,
      sameSite: 'strict',
      secure: isProduction,
      path: this.cookiePath,
    };
  }
}
