import { ApiProperty } from '@nestjs/swagger';

export class AuthEmployeeDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Nguyễn Văn Admin' })
  fullName: string;

  @ApiProperty({ example: null, nullable: true, type: String })
  avatarUrl: string | null;
}

export class AuthUserDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'admin' })
  username: string;

  @ApiProperty({ example: 'admin@company.com' })
  email: string;

  @ApiProperty({ example: 'admin', description: 'roles.name' })
  role: string;

  @ApiProperty({
    type: AuthEmployeeDto,
    nullable: true,
    description: 'null nếu tài khoản chưa liên kết hồ sơ nhân viên',
  })
  employee: AuthEmployeeDto | null;
}

/**
 * Body trả về của `POST /auth/login`.
 *
 * ⚠️ KHÔNG có `refreshToken`: refresh token được đặt trong cookie
 * `HttpOnly; SameSite=Strict; Secure(prod)` – xem RefreshCookieService.
 * (api-spec.md §2 mô tả refreshToken nằm trong body, đã lạc hậu –
 * architecture.md §7.1 + PLAN 1.1 là nguồn chuẩn.)
 */
export class LoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOi...' })
  accessToken: string;

  @ApiProperty({
    example: 900,
    description: 'Số giây access token còn hiệu lực',
  })
  expiresIn: number;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}

/** Body trả về của `POST /auth/refresh` (refresh token mới nằm trong cookie). */
export class RefreshResponseDto {
  @ApiProperty({ example: 'eyJhbGciOi...' })
  accessToken: string;

  @ApiProperty({ example: 900 })
  expiresIn: number;
}

/** Body trả về của các endpoint chỉ báo trạng thái (logout, đổi mật khẩu...). */
export class AuthActionResponseDto {
  @ApiProperty({ example: true })
  ok: boolean;
}
