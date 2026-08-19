import { PORTAL_LOGIN_ROLES } from '@/common/constants/roles.constant';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthConfig } from '@/config/auth.config';
import { JwtConfig } from '@/config/jwt.config';
import { AccessTokenPayload } from '@/common/types/authenticated-user';
import { parseDurationToSeconds } from '@/common/utils/duration.util';
import { generateRandomToken, sha256Hex } from '@/common/utils/hash.util';
import { CacheService } from '@/shared/cache/cache.service';
import { MailService } from '@/shared/mail/mail.service';
import { User, UserStatus } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';
import {
  loginFailureCacheKey,
  loginLockCacheKey,
  RESET_TOKEN_GRACE_SECONDS,
  resetTokenCacheKey,
  ResetTokenCachePayload,
  TOKEN_RANDOM_BYTES,
} from './auth.constants';
import { AuthUserDto } from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokensRepository } from './refresh-tokens.repository';

export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface IssuedRefreshToken {
  /** Giá trị thật – chỉ được đặt vào cookie HttpOnly, không trả trong body. */
  token: string;
  /** rememberMe: cookie có maxAge (true) hay session cookie (false). */
  persistent: boolean;
  /** maxAge (ms) áp dụng khi persistent = true. */
  maxAgeMs: number;
  /** refresh_tokens.id vừa tạo – đi vào claim `sid` của access token. */
  sessionId: number;
}

export interface LoginResult {
  accessToken: string;
  expiresIn: number;
  user: AuthUserDto;
  refresh: IssuedRefreshToken;
}

export interface RefreshResult {
  accessToken: string;
  expiresIn: number;
  refresh: IssuedRefreshToken;
}

/** Prefix đánh dấu refresh token "ghi nhớ đăng nhập" (xem buildRefreshTokenValue). */
const PERSISTENT_PREFIX = 'p.';
const SESSION_PREFIX = 's.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly auth: AuthConfig;
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlSeconds: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly refreshTokensRepository: RefreshTokensRepository,
    private readonly cacheService: CacheService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.auth = this.configService.getOrThrow<AuthConfig>('auth');
    const jwt = this.configService.getOrThrow<JwtConfig>('jwt');
    this.accessTokenTtlSeconds = parseDurationToSeconds(jwt.expiresIn);
    this.refreshTokenTtlSeconds = parseDurationToSeconds(jwt.refreshExpiresIn);
  }

  // ---------------------------------------------------------------- login ----

  /**
   * Đăng nhập bằng username HOẶC email + password.
   *
   * Thứ tự kiểm tra (quan trọng về bảo mật):
   *  1. Đang bị khoá? → 423 ACCOUNT_LOCKED (kèm thời gian còn lại)
   *  2. Sai định danh/mật khẩu → tăng counter → 401, hoặc 429 nếu lần này làm
   *     tài khoản bị khoá (PLAN 1.1: lần "trip" trả 429, các lần sau trả 423)
   *  3. Chỉ SAU khi mật khẩu đúng mới kiểm tra `users.status` (không tiết lộ
   *     trạng thái tài khoản cho người không biết mật khẩu)
   */
  async login(
    dto: LoginUserDto,
    context: RequestContext,
  ): Promise<LoginResult> {
    const identifier = dto.username.trim();

    await this.assertNotLocked(identifier);

    const user =
      await this.usersService.findByUsernameOrEmailWithPassword(identifier);

    if (!user) {
      throw await this.registerFailedAttempt(identifier);
    }

    const passwordMatched = await this.usersService.comparePassword(
      dto.password,
      user.password,
    );

    if (!passwordMatched) {
      throw await this.registerFailedAttempt(identifier);
    }

    this.assertUserCanLogin(user);

    await this.clearFailedAttempts(identifier);
    // Xoá luôn counter theo username + email để mọi cách nhập đều được reset.
    await this.clearFailedAttempts(user.username);
    await this.clearFailedAttempts(user.email);

    const userId = Number(user.id);
    const now = new Date();

    await this.enforceSessionLimit(userId, now);
    const refresh = await this.issueRefreshToken(
      userId,
      dto.rememberMe === true,
      context,
    );
    const accessToken = await this.signAccessToken(user, refresh.sessionId);
    await this.usersService.markLoggedIn(userId, now);

    this.logger.log(`Login thành công: user ${userId} (${user.username})`);

    return {
      accessToken,
      expiresIn: this.accessTokenTtlSeconds,
      user: this.toAuthUser(user),
      refresh,
    };
  }

  // -------------------------------------------------------------- refresh ----

  /**
   * Rotation: revoke bản ghi cũ + phát hành token mới.
   * Phát hiện dùng lại token đã revoke → revoke TOÀN BỘ session của user
   * (architecture.md §7.4 – dấu hiệu token bị đánh cắp).
   */
  async refresh(
    rawToken: string | undefined,
    context: RequestContext,
  ): Promise<RefreshResult> {
    if (!rawToken) {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Missing refresh token cookie',
      });
    }

    const tokenHash = sha256Hex(rawToken);
    const stored =
      await this.refreshTokensRepository.findByTokenHash(tokenHash);

    if (!stored) {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Refresh token is invalid',
      });
    }

    const userId = Number(stored.userId);

    if (stored.revokedAt) {
      const revokedCount =
        await this.refreshTokensRepository.revokeAllByUserId(userId);
      this.logger.warn(
        `Refresh token reuse detected cho user ${userId}: đã revoke ${revokedCount} session còn lại`,
      );
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Refresh token has already been used; all sessions revoked',
      });
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      await this.refreshTokensRepository.revokeById(Number(stored.id));
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_EXPIRED',
        message: 'Refresh token has expired, please login again',
      });
    }

    const user = await this.usersService.findById(userId);

    /*
     * Kiểm CẢ vai trò, không chỉ `status`. Một tài khoản bị chuyển sang vai trò
     * `employee` sau khi đã đăng nhập vẫn còn refresh token hợp lệ trong tay;
     * chỉ kiểm `status` thì phiên đó sống tới khi token hết hạn, tức là quyền
     * đã bị thu hồi trên giấy nhưng chưa có hiệu lực thật.
     */
    const roleAllowed =
      user?.role?.name === undefined ||
      PORTAL_LOGIN_ROLES.includes(user.role.name);

    if (!user || user.status !== UserStatus.ACTIVE || !roleAllowed) {
      await this.refreshTokensRepository.revokeAllByUserId(userId);
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'User is no longer allowed to refresh',
      });
    }

    await this.refreshTokensRepository.revokeById(Number(stored.id));

    const refresh = await this.issueRefreshToken(
      userId,
      isPersistentRefreshToken(rawToken),
      context,
    );
    const accessToken = await this.signAccessToken(user, refresh.sessionId);

    return {
      accessToken,
      expiresIn: this.accessTokenTtlSeconds,
      refresh,
    };
  }

  // --------------------------------------------------------------- logout ----

  /**
   * Revoke session hiện tại, xác định qua claim `sid` của access token.
   *
   * KHÔNG đọc cookie: cookie refresh token bị giới hạn `Path=/<prefix>/auth/refresh`
   * nên request tới `/auth/logout` không hề nhận được nó (xem RefreshCookieService).
   * Vẫn giữ nguyên nguyên tắc "không revoke session của người khác": chỉ revoke khi
   * `refresh_tokens.user_id` trùng với `sub` của access token.
   * Idempotent: sid thiếu / row không tồn tại / row đã revoke → coi như thành công.
   */
  async logout(userId: number, sessionId: number | null): Promise<void> {
    if (sessionId === null || Number.isNaN(sessionId)) {
      return;
    }

    const stored = await this.refreshTokensRepository.findById(sessionId);

    if (!stored || Number(stored.userId) !== userId) {
      this.logger.warn(
        `Logout: bỏ qua session ${sessionId} – không tồn tại hoặc không thuộc user ${userId}`,
      );
      return;
    }

    await this.refreshTokensRepository.revokeById(Number(stored.id));
    this.logger.log(`Logout: revoke session ${stored.id} của user ${userId}`);
  }

  // ------------------------------------------------------ change password ----

  /** Đổi mật khẩu → revoke TẤT CẢ session (database-schema.md §1.5). */
  async changePassword(userId: number, dto: ChangePasswordDto): Promise<void> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException({
        code: 'PASSWORD_MISMATCH',
        message: 'newPassword and confirmPassword do not match',
      });
    }

    const user = await this.usersService.findByIdWithPassword(userId);

    if (!user) {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Authenticated user no longer exists',
      });
    }

    const matched = await this.usersService.comparePassword(
      dto.currentPassword,
      user.password,
    );

    if (!matched) {
      throw new UnauthorizedException({
        code: 'WRONG_CURRENT_PASSWORD',
        message: 'Current password is incorrect',
      });
    }

    await this.usersService.updatePassword(userId, dto.newPassword);
    const revoked =
      await this.refreshTokensRepository.revokeAllByUserId(userId);

    this.logger.log(
      `Đổi mật khẩu thành công cho user ${userId}; revoke ${revoked} session`,
    );
  }

  // ------------------------------------------------------ forgot password ----

  /**
   * Luôn trả về cùng một kết quả dù email có tồn tại hay không (chống
   * user enumeration – api-spec.md §2 không phân biệt case này).
   * Cache chỉ lưu SHA-256 hash của token; token thật chỉ nằm trong email.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user || user.status !== UserStatus.ACTIVE) {
      this.logger.warn(
        `Forgot-password cho email không tồn tại hoặc không active: ${dto.email}`,
      );
      return;
    }

    const rawToken = generateRandomToken(TOKEN_RANDOM_BYTES);
    const ttlSeconds = this.auth.resetTokenTtlMinutes * 60;
    const payload: ResetTokenCachePayload = {
      userId: Number(user.id),
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    };

    await this.cacheService.set(
      resetTokenCacheKey(sha256Hex(rawToken)),
      payload,
      // Giữ thêm grace period để phân biệt EXPIRED với INVALID.
      ttlSeconds + RESET_TOKEN_GRACE_SECONDS,
    );

    await this.mailService.sendResetPasswordEmail({
      to: user.email,
      recipientName: user.employee?.fullName ?? user.username,
      rawToken,
      expiresInMinutes: this.auth.resetTokenTtlMinutes,
    });
  }

  // ------------------------------------------------------- reset password ----

  /** Token dùng MỘT LẦN: xoá khỏi cache ngay khi dùng thành công. */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException({
        code: 'PASSWORD_MISMATCH',
        message: 'newPassword and confirmPassword do not match',
      });
    }

    const cacheKey = resetTokenCacheKey(sha256Hex(dto.token));
    const payload =
      await this.cacheService.get<ResetTokenCachePayload>(cacheKey);

    if (!payload) {
      throw new BadRequestException({
        code: 'RESET_TOKEN_INVALID',
        message: 'Reset token is invalid or has already been used',
      });
    }

    if (new Date(payload.expiresAt).getTime() <= Date.now()) {
      await this.cacheService.del(cacheKey);
      throw new BadRequestException({
        code: 'RESET_TOKEN_EXPIRED',
        message: `Reset token expired (valid for ${this.auth.resetTokenTtlMinutes} minutes)`,
      });
    }

    const user = await this.usersService.findById(payload.userId);

    if (!user) {
      await this.cacheService.del(cacheKey);
      throw new BadRequestException({
        code: 'RESET_TOKEN_INVALID',
        message: 'Reset token no longer maps to an existing user',
      });
    }

    await this.usersService.updatePassword(payload.userId, dto.newPassword);
    await this.cacheService.del(cacheKey);
    const revoked = await this.refreshTokensRepository.revokeAllByUserId(
      payload.userId,
    );

    // Đặt lại mật khẩu thành công thì bỏ luôn trạng thái khoá do đăng nhập sai.
    await this.clearFailedAttempts(user.username);
    await this.clearFailedAttempts(user.email);

    this.logger.log(
      `Reset password thành công cho user ${payload.userId}; revoke ${revoked} session`,
    );
  }

  // ------------------------------------------------------------- profile ----

  /** `GET /auth/me` – frontend gọi sau F5 để dựng lại session. */
  async getProfile(userId: number): Promise<AuthUserDto> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Authenticated user no longer exists',
      });
    }

    return this.toAuthUser(user);
  }

  // ------------------------------------------------------------ internals ----

  private assertUserCanLogin(user: User): void {
    if (user.status === UserStatus.LOCKED) {
      throw new HttpException(
        {
          code: 'ACCOUNT_LOCKED',
          message: 'Account is locked, please contact HR/administrator',
        },
        HttpStatus.LOCKED,
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException({
        code: 'ACCOUNT_INACTIVE',
        message: `Account status is "${user.status}" and cannot login`,
      });
    }

    /*
     * Nhân viên thường không dùng hệ thống quản trị này; họ sẽ có cổng riêng
     * ("MyPage") được xây sau. Chặn Ở ĐÂY, sau khi mật khẩu đã đúng, để không
     * phát access token và không tạo bản ghi `refresh_tokens` cho một tài khoản
     * không được phép vào.
     *
     * Đặt SAU bước kiểm mật khẩu là có chủ ý: trả lời "vai trò này không được
     * vào" trước khi biết mật khẩu có đúng hay không sẽ biến form đăng nhập
     * thành công cụ dò xem một tài khoản mang vai trò gì.
     */
    const roleName = user.role?.name;

    if (roleName !== undefined && !PORTAL_LOGIN_ROLES.includes(roleName)) {
      throw new ForbiddenException({
        code: 'PORTAL_ACCESS_DENIED',
        message: `Role "${roleName}" cannot sign in to the admin portal; requires one of roles: ${PORTAL_LOGIN_ROLES.join(', ')}`,
      });
    }
  }

  private async assertNotLocked(identifier: string): Promise<void> {
    const remainingSeconds = await this.cacheService.ttl(
      loginLockCacheKey(identifier),
    );

    if (remainingSeconds === -2) {
      return;
    }

    const safeRemaining = Math.max(remainingSeconds, 0);
    const minutes = Math.ceil(safeRemaining / 60);

    throw new HttpException(
      {
        code: 'ACCOUNT_LOCKED',
        message: `Account is temporarily locked after ${this.auth.maxFailedLoginAttempts} failed login attempts. Try again in ${minutes} minute(s) (${safeRemaining}s remaining)`,
        // Becomes the `Retry-After` header (see HttpExceptionFilter). The time
        // must be machine-readable: `message` is English developer text, so the
        // UI cannot parse it to tell the user how long the lock lasts.
        retryAfterSeconds: safeRemaining,
      },
      HttpStatus.LOCKED,
    );
  }

  /**
   * Đếm số lần sai và TRẢ VỀ exception để caller `throw`.
   * Lần sai làm vượt ngưỡng → set khoá + 429 (PLAN 1.1); các lần sau sẽ bị
   * `assertNotLocked` chặn với 423.
   */
  private async registerFailedAttempt(
    identifier: string,
  ): Promise<HttpException> {
    const lockoutSeconds = this.auth.lockoutMinutes * 60;
    const attempts = await this.cacheService.incr(
      loginFailureCacheKey(identifier),
      lockoutSeconds,
    );

    if (attempts >= this.auth.maxFailedLoginAttempts) {
      await this.cacheService.set(
        loginLockCacheKey(identifier),
        { lockedAt: new Date().toISOString() },
        lockoutSeconds,
      );
      await this.cacheService.del(loginFailureCacheKey(identifier));

      this.logger.warn(
        `Khoá đăng nhập ${this.auth.lockoutMinutes} phút cho định danh "${identifier}" sau ${attempts} lần sai`,
      );

      return new HttpException(
        {
          code: 'ACCOUNT_LOCKED',
          message: `Too many failed login attempts (${attempts}). Account locked for ${this.auth.lockoutMinutes} minutes`,
          // The attempt that trips the lock also reports the full wait.
          retryAfterSeconds: lockoutSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return new UnauthorizedException({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid username/email or password',
    });
  }

  private async clearFailedAttempts(identifier: string): Promise<void> {
    await this.cacheService.del(loginFailureCacheKey(identifier));
    await this.cacheService.del(loginLockCacheKey(identifier));
  }

  /**
   * Tối đa `maxConcurrentSessions` session còn hiệu lực / user.
   * Nếu thêm 1 session nữa sẽ vượt ngưỡng → revoke các session CŨ NHẤT
   * (login mới luôn thắng).
   */
  private async enforceSessionLimit(userId: number, now: Date): Promise<void> {
    const activeSessions =
      await this.refreshTokensRepository.findActiveByUserIdOldestFirst(
        userId,
        now,
      );

    const allowedBeforeNewLogin = this.auth.maxConcurrentSessions - 1;
    const excess = activeSessions.length - allowedBeforeNewLogin;

    for (let index = 0; index < excess; index++) {
      await this.refreshTokensRepository.revokeById(
        Number(activeSessions[index].id),
      );
      this.logger.warn(
        `Vượt giới hạn ${this.auth.maxConcurrentSessions} session: kick session cũ nhất (id=${activeSessions[index].id}) của user ${userId}`,
      );
    }
  }

  private async issueRefreshToken(
    userId: number,
    persistent: boolean,
    context: RequestContext,
  ): Promise<IssuedRefreshToken> {
    const token = buildRefreshTokenValue(persistent);
    const expiresAt = new Date(Date.now() + this.refreshTokenTtlSeconds * 1000);

    const created = await this.refreshTokensRepository.create({
      userId,
      tokenHash: sha256Hex(token),
      device: context.userAgent ? context.userAgent.slice(0, 255) : null,
      ipAddress: context.ipAddress ? context.ipAddress.slice(0, 45) : null,
      expiresAt,
    });

    return {
      token,
      persistent,
      maxAgeMs: this.refreshTokenTtlSeconds * 1000,
      sessionId: Number(created.id),
    };
  }

  /**
   * @param sessionId refresh_tokens.id của session vừa phát hành → đi vào claim
   * `sid`. Mỗi lần rotation tạo row mới nên access token mới phải mang id mới.
   */
  private signAccessToken(user: User, sessionId: number): Promise<string> {
    const roleName = user.role?.name;

    if (!roleName) {
      throw new InternalServerErrorException({
        code: 'INTERNAL_ERROR',
        message: `User ${user.id} has no role assigned`,
      });
    }

    const payload: AccessTokenPayload = {
      sub: Number(user.id),
      username: user.username,
      role: roleName,
      employeeId: user.employeeId === null ? null : Number(user.employeeId),
      sid: sessionId,
    };

    return this.jwtService.signAsync(payload);
  }

  private toAuthUser(user: User): AuthUserDto {
    const roleName = user.role?.name;

    if (!roleName) {
      throw new InternalServerErrorException({
        code: 'INTERNAL_ERROR',
        message: `User ${user.id} has no role assigned`,
      });
    }

    return {
      id: Number(user.id),
      username: user.username,
      email: user.email,
      role: roleName,
      employee: user.employee
        ? {
            id: Number(user.employee.id),
            fullName: user.employee.fullName,
            avatarUrl: user.employee.avatarUrl,
          }
        : null,
    };
  }
}

/**
 * Refresh token = `<prefix><random hex>`.
 *
 * Prefix mã hoá lựa chọn "Ghi nhớ đăng nhập" ngay trong token để sau mỗi lần
 * rotation vẫn biết nên set cookie persistent hay session cookie, mà không cần
 * thêm cột DB / cache (state cache sẽ mất khi restart). Prefix chỉ tiết lộ việc
 * người dùng có tick checkbox hay không – không phải dữ liệu nhạy cảm.
 * DB chỉ lưu SHA-256 của TOÀN BỘ chuỗi này.
 */
export function buildRefreshTokenValue(persistent: boolean): string {
  const prefix = persistent ? PERSISTENT_PREFIX : SESSION_PREFIX;
  return `${prefix}${generateRandomToken(TOKEN_RANDOM_BYTES)}`;
}

export function isPersistentRefreshToken(token: string): boolean {
  return token.startsWith(PERSISTENT_PREFIX);
}
