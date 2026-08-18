import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthConfig } from '@/config/auth.config';
import { JwtConfig } from '@/config/jwt.config';
import { sha256Hex } from '@/common/utils/hash.util';
import { CacheService } from '@/shared/cache/cache.service';
import { InMemoryCacheService } from '@/shared/cache/in-memory-cache.service';
import { MailService } from '@/shared/mail/mail.service';
import { User, UserStatus } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';
import { AuthService, buildRefreshTokenValue } from './auth.service';
import { resetTokenCacheKey, ResetTokenCachePayload } from './auth.constants';
import { RefreshToken } from './entities/refresh-token.entity';
import { RefreshTokensRepository } from './refresh-tokens.repository';

const AUTH_CONFIG: AuthConfig = {
  maxFailedLoginAttempts: 5,
  lockoutMinutes: 15,
  maxConcurrentSessions: 5,
  resetTokenTtlMinutes: 30,
  refreshCookieName: 'refresh_token',
  frontendUrl: 'http://localhost:5173',
};

const JWT_CONFIG: JwtConfig = {
  secret: 'x'.repeat(64),
  expiresIn: '15m',
  refreshExpiresIn: '7d',
};

const CONTEXT = { ipAddress: '127.0.0.1', userAgent: 'jest' };

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 5,
    username: 'an.hoang',
    email: 'an.hoang@hrm.local',
    password: '$2b$10$hashed',
    roleId: 5,
    role: { id: 5, name: 'employee' },
    employeeId: 5,
    employee: { id: 5, fullName: 'Hoàng Thị An', avatarUrl: null },
    status: UserStatus.ACTIVE,
    lastLoginAt: null,
    ...overrides,
  } as User;
}

function makeRefreshTokenRow(
  overrides: Partial<RefreshToken> = {},
): RefreshToken {
  return {
    id: 100,
    userId: 5,
    tokenHash: 'hash',
    device: null,
    ipAddress: null,
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    createdAt: new Date(),
    ...overrides,
  } as RefreshToken;
}

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let refreshTokens: jest.Mocked<RefreshTokensRepository>;
  let cache: InMemoryCacheService;
  let mailService: jest.Mocked<MailService>;

  beforeEach(async () => {
    cache = new InMemoryCacheService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByUsernameOrEmailWithPassword: jest.fn(),
            findByEmail: jest.fn(),
            findById: jest.fn(),
            findByIdWithPassword: jest.fn(),
            comparePassword: jest.fn(),
            updatePassword: jest.fn().mockResolvedValue(undefined),
            markLoggedIn: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: RefreshTokensRepository,
          useValue: {
            create: jest.fn().mockResolvedValue(makeRefreshTokenRow()),
            findByTokenHash: jest.fn(),
            findById: jest.fn(),
            countActiveByUserId: jest.fn().mockResolvedValue(0),
            findActiveByUserIdOldestFirst: jest.fn().mockResolvedValue([]),
            revokeById: jest.fn().mockResolvedValue(undefined),
            revokeAllByUserId: jest.fn().mockResolvedValue(2),
          },
        },
        { provide: CacheService, useValue: cache },
        {
          provide: MailService,
          useValue: {
            sendResetPasswordEmail: jest
              .fn()
              .mockResolvedValue({ transport: 'dev', reference: 'file.html' }),
          },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('signed.jwt') },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) =>
              key === 'auth' ? AUTH_CONFIG : JWT_CONFIG,
            get: (key: string) => (key === 'app.nodeEnv' ? 'test' : undefined),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    usersService = module.get(UsersService);
    refreshTokens = module.get(RefreshTokensRepository);
    mailService = module.get(MailService);
  });

  afterEach(() => {
    cache.onModuleDestroy();
    jest.clearAllMocks();
  });

  // ------------------------------------------------------------------ login --

  describe('login', () => {
    it('trả access token + refresh token và cập nhật last_login_at khi đúng mật khẩu', async () => {
      usersService.findByUsernameOrEmailWithPassword.mockResolvedValue(
        makeUser(),
      );
      usersService.comparePassword.mockResolvedValue(true);

      const result = await service.login(
        // Giá trị bất kỳ: `comparePassword` đã được mock trả về true ở trên.
        { username: 'an.hoang', password: 'irrelevant-mocked-password' },
        CONTEXT,
      );

      expect(result.accessToken).toBe('signed.jwt');
      expect(result.expiresIn).toBe(900);
      expect(result.user).toEqual({
        id: 5,
        username: 'an.hoang',
        email: 'an.hoang@hrm.local',
        role: 'employee',
        employee: { id: 5, fullName: 'Hoàng Thị An', avatarUrl: null },
      });
      expect(result.refresh.persistent).toBe(false);
      expect(result.refresh.maxAgeMs).toBe(7 * 24 * 3600 * 1000);
      expect(usersService.markLoggedIn).toHaveBeenCalledWith(
        5,
        expect.any(Date),
      );
      const created = refreshTokens.create.mock.calls[0][0];
      expect(created.userId).toBe(5);
      expect(created.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(created.device).toBe('jest');
      expect(created.ipAddress).toBe('127.0.0.1');
    });

    it('rememberMe = true → cookie persistent (chỉ đổi tuổi thọ cookie)', async () => {
      usersService.findByUsernameOrEmailWithPassword.mockResolvedValue(
        makeUser(),
      );
      usersService.comparePassword.mockResolvedValue(true);

      const result = await service.login(
        { username: 'an.hoang', password: 'ok', rememberMe: true },
        CONTEXT,
      );

      expect(result.refresh.persistent).toBe(true);
    });

    it('KHÔNG lưu token thật vào DB, chỉ lưu SHA-256 hash', async () => {
      usersService.findByUsernameOrEmailWithPassword.mockResolvedValue(
        makeUser(),
      );
      usersService.comparePassword.mockResolvedValue(true);

      const result = await service.login(
        { username: 'an.hoang', password: 'ok' },
        CONTEXT,
      );

      const created = refreshTokens.create.mock.calls[0][0];
      expect(created.tokenHash).toBe(sha256Hex(result.refresh.token));
      expect(created.tokenHash).not.toBe(result.refresh.token);
    });

    it('sai mật khẩu → 401 INVALID_CREDENTIALS', async () => {
      usersService.findByUsernameOrEmailWithPassword.mockResolvedValue(
        makeUser(),
      );
      usersService.comparePassword.mockResolvedValue(false);

      await expect(
        service.login({ username: 'an.hoang', password: 'wrong' }, CONTEXT),
      ).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
        response: { code: 'INVALID_CREDENTIALS' },
      });
      expect(refreshTokens.create).not.toHaveBeenCalled();
    });

    it('không tìm thấy user → 401 INVALID_CREDENTIALS (không tiết lộ user tồn tại hay không)', async () => {
      usersService.findByUsernameOrEmailWithPassword.mockResolvedValue(null);

      await expect(
        service.login({ username: 'khong.ton.tai', password: 'x' }, CONTEXT),
      ).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
        response: { code: 'INVALID_CREDENTIALS' },
      });
    });

    it('status = locked → 423 ACCOUNT_LOCKED', async () => {
      usersService.findByUsernameOrEmailWithPassword.mockResolvedValue(
        makeUser({ status: UserStatus.LOCKED }),
      );
      usersService.comparePassword.mockResolvedValue(true);

      await expect(
        service.login({ username: 'locked.user', password: 'ok' }, CONTEXT),
      ).rejects.toMatchObject({
        status: HttpStatus.LOCKED,
        response: { code: 'ACCOUNT_LOCKED' },
      });
    });

    it('status = inactive → 403 ACCOUNT_INACTIVE', async () => {
      usersService.findByUsernameOrEmailWithPassword.mockResolvedValue(
        makeUser({ status: UserStatus.INACTIVE }),
      );
      usersService.comparePassword.mockResolvedValue(true);

      await expect(
        service.login({ username: 'inactive.user', password: 'ok' }, CONTEXT),
      ).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { code: 'ACCOUNT_INACTIVE' },
      });
    });

    it('trạng thái tài khoản chỉ được kiểm tra SAU khi mật khẩu đúng', async () => {
      usersService.findByUsernameOrEmailWithPassword.mockResolvedValue(
        makeUser({ status: UserStatus.LOCKED }),
      );
      usersService.comparePassword.mockResolvedValue(false);

      await expect(
        service.login({ username: 'locked.user', password: 'wrong' }, CONTEXT),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_CREDENTIALS' },
      });
    });

    it('user không có role → 500 INTERNAL_ERROR (lỗi toàn vẹn dữ liệu)', async () => {
      usersService.findByUsernameOrEmailWithPassword.mockResolvedValue(
        makeUser({ role: undefined }),
      );
      usersService.comparePassword.mockResolvedValue(true);

      await expect(
        service.login({ username: 'an.hoang', password: 'ok' }, CONTEXT),
      ).rejects.toMatchObject({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        response: { code: 'INTERNAL_ERROR' },
      });
    });
  });

  // --------------------------------------------------------------- lockout ---

  describe('account lockout', () => {
    beforeEach(() => {
      usersService.findByUsernameOrEmailWithPassword.mockResolvedValue(
        makeUser(),
      );
      usersService.comparePassword.mockResolvedValue(false);
    });

    async function attemptLogin(): Promise<HttpException> {
      try {
        await service.login(
          { username: 'an.hoang', password: 'wrong' },
          CONTEXT,
        );
        throw new Error('login should have failed');
      } catch (error) {
        return error as HttpException;
      }
    }

    it('4 lần sai đầu → 401; lần thứ 5 (trip) → 429; lần thứ 6 → 423 kèm thời gian còn lại', async () => {
      for (let i = 1; i <= 4; i++) {
        const error = await attemptLogin();
        expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      }

      const tripError = await attemptLogin();
      expect(tripError.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(tripError.getResponse()).toMatchObject({ code: 'ACCOUNT_LOCKED' });

      const lockedError = await attemptLogin();
      expect(lockedError.getStatus()).toBe(HttpStatus.LOCKED);
      const body = lockedError.getResponse() as {
        code: string;
        message: string;
      };
      expect(body.code).toBe('ACCOUNT_LOCKED');
      expect(body.message).toMatch(/remaining/);
      expect(body.message).toMatch(/15 minute/);
    });

    it('đang bị khoá thì mật khẩu đúng cũng bị chặn (423)', async () => {
      for (let i = 1; i <= 5; i++) {
        await attemptLogin();
      }

      usersService.comparePassword.mockResolvedValue(true);
      await expect(
        service.login({ username: 'an.hoang', password: 'correct' }, CONTEXT),
      ).rejects.toMatchObject({ status: HttpStatus.LOCKED });
    });

    it('login thành công xoá counter (các lần sai trước không tích luỹ)', async () => {
      await attemptLogin();
      await attemptLogin();

      usersService.comparePassword.mockResolvedValue(true);
      await service.login(
        { username: 'an.hoang', password: 'correct' },
        CONTEXT,
      );

      usersService.comparePassword.mockResolvedValue(false);
      for (let i = 1; i <= 4; i++) {
        const error = await attemptLogin();
        expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      }
      const tripError = await attemptLogin();
      expect(tripError.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });

    it('counter tính theo định danh đã nhập, không phân biệt hoa/thường', async () => {
      for (let i = 1; i <= 5; i++) {
        try {
          await service.login(
            { username: 'AN.HOANG', password: 'wrong' },
            CONTEXT,
          );
        } catch {
          // bỏ qua – đang đếm số lần sai
        }
      }

      await expect(
        service.login({ username: 'an.hoang', password: 'wrong' }, CONTEXT),
      ).rejects.toMatchObject({ status: HttpStatus.LOCKED });
    });
  });

  // ---------------------------------------------------------- session limit ---

  describe('giới hạn 5 session đồng thời', () => {
    beforeEach(() => {
      usersService.findByUsernameOrEmailWithPassword.mockResolvedValue(
        makeUser(),
      );
      usersService.comparePassword.mockResolvedValue(true);
    });

    it('login thứ 6 → revoke session cũ nhất', async () => {
      const active = [1, 2, 3, 4, 5].map((id) =>
        makeRefreshTokenRow({ id: id * 10 }),
      );
      refreshTokens.findActiveByUserIdOldestFirst.mockResolvedValue(active);

      await service.login({ username: 'an.hoang', password: 'ok' }, CONTEXT);

      expect(refreshTokens.revokeById).toHaveBeenCalledTimes(1);
      expect(refreshTokens.revokeById).toHaveBeenCalledWith(10);
    });

    it('còn dưới giới hạn → không revoke session nào', async () => {
      refreshTokens.findActiveByUserIdOldestFirst.mockResolvedValue([
        makeRefreshTokenRow({ id: 10 }),
        makeRefreshTokenRow({ id: 20 }),
      ]);

      await service.login({ username: 'an.hoang', password: 'ok' }, CONTEXT);

      expect(refreshTokens.revokeById).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------- refresh --

  describe('refresh', () => {
    it('token hợp lệ → rotation: revoke bản ghi cũ + tạo bản ghi mới', async () => {
      const rawToken = buildRefreshTokenValue(false);
      refreshTokens.findByTokenHash.mockResolvedValue(
        makeRefreshTokenRow({ id: 77, tokenHash: sha256Hex(rawToken) }),
      );
      usersService.findById.mockResolvedValue(makeUser());

      const result = await service.refresh(rawToken, CONTEXT);

      expect(refreshTokens.revokeById).toHaveBeenCalledWith(77);
      expect(refreshTokens.create).toHaveBeenCalledTimes(1);
      expect(result.accessToken).toBe('signed.jwt');
      expect(result.refresh.token).not.toBe(rawToken);
    });

    it('giữ nguyên lựa chọn rememberMe sau khi rotation', async () => {
      const rawToken = buildRefreshTokenValue(true);
      refreshTokens.findByTokenHash.mockResolvedValue(
        makeRefreshTokenRow({ tokenHash: sha256Hex(rawToken) }),
      );
      usersService.findById.mockResolvedValue(makeUser());

      const result = await service.refresh(rawToken, CONTEXT);

      expect(result.refresh.persistent).toBe(true);
    });

    it('thiếu cookie → 401 TOKEN_INVALID', async () => {
      await expect(service.refresh(undefined, CONTEXT)).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
        response: { code: 'TOKEN_INVALID' },
      });
    });

    it('token không có trong DB → 401 TOKEN_INVALID', async () => {
      refreshTokens.findByTokenHash.mockResolvedValue(null);

      await expect(service.refresh('unknown', CONTEXT)).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
        response: { code: 'TOKEN_INVALID' },
      });
    });

    it('token hết hạn → 401 REFRESH_TOKEN_EXPIRED', async () => {
      refreshTokens.findByTokenHash.mockResolvedValue(
        makeRefreshTokenRow({
          id: 88,
          expiresAt: new Date(Date.now() - 1000),
        }),
      );

      await expect(service.refresh('expired', CONTEXT)).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
        response: { code: 'REFRESH_TOKEN_EXPIRED' },
      });
      expect(refreshTokens.revokeById).toHaveBeenCalledWith(88);
      expect(refreshTokens.create).not.toHaveBeenCalled();
    });

    it('dùng lại token đã revoke → 401 + revoke TOÀN BỘ session của user', async () => {
      refreshTokens.findByTokenHash.mockResolvedValue(
        makeRefreshTokenRow({ revokedAt: new Date() }),
      );

      await expect(service.refresh('reused', CONTEXT)).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
        response: { code: 'TOKEN_INVALID' },
      });
      expect(refreshTokens.revokeAllByUserId).toHaveBeenCalledWith(5);
      expect(refreshTokens.create).not.toHaveBeenCalled();
    });

    it('user không còn active → 401 + revoke toàn bộ session', async () => {
      refreshTokens.findByTokenHash.mockResolvedValue(makeRefreshTokenRow());
      usersService.findById.mockResolvedValue(
        makeUser({ status: UserStatus.LOCKED }),
      );

      await expect(service.refresh('token', CONTEXT)).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
      });
      expect(refreshTokens.revokeAllByUserId).toHaveBeenCalledWith(5);
    });
  });

  // ----------------------------------------------------------------- logout --

  describe('logout', () => {
    it('revoke đúng session theo claim sid (KHÔNG đọc cookie)', async () => {
      refreshTokens.findById.mockResolvedValue(makeRefreshTokenRow({ id: 55 }));

      await service.logout(5, 55);

      expect(refreshTokens.findById).toHaveBeenCalledWith(55);
      expect(refreshTokens.revokeById).toHaveBeenCalledWith(55);
      expect(refreshTokens.findByTokenHash).not.toHaveBeenCalled();
    });

    it('access token không có sid → không làm gì (idempotent)', async () => {
      await service.logout(5, null);

      expect(refreshTokens.findById).not.toHaveBeenCalled();
      expect(refreshTokens.revokeById).not.toHaveBeenCalled();
    });

    it('sid không tồn tại trong DB → không lỗi, không revoke', async () => {
      refreshTokens.findById.mockResolvedValue(null);

      await expect(service.logout(5, 4242)).resolves.toBeUndefined();
      expect(refreshTokens.revokeById).not.toHaveBeenCalled();
    });

    it('sid thuộc user khác → KHÔNG revoke (không logout hộ người khác)', async () => {
      refreshTokens.findById.mockResolvedValue(
        makeRefreshTokenRow({ id: 55, userId: 999 }),
      );

      await service.logout(5, 55);

      expect(refreshTokens.revokeById).not.toHaveBeenCalled();
    });

    it('login/refresh gắn sid = id bản ghi refresh token vừa tạo', async () => {
      usersService.findByUsernameOrEmailWithPassword.mockResolvedValue(
        makeUser(),
      );
      usersService.comparePassword.mockResolvedValue(true);
      refreshTokens.create.mockResolvedValue(makeRefreshTokenRow({ id: 321 }));

      const result = await service.login(
        { username: 'an.hoang', password: 'ok' },
        CONTEXT,
      );

      expect(result.refresh.sessionId).toBe(321);
    });
  });

  // -------------------------------------------------------- change password --

  describe('changePassword', () => {
    it('đổi mật khẩu thành công → revoke toàn bộ session', async () => {
      usersService.findByIdWithPassword.mockResolvedValue(makeUser());
      usersService.comparePassword.mockResolvedValue(true);

      await service.changePassword(5, {
        currentPassword: 'old',
        newPassword: 'NewPass@2026',
        confirmPassword: 'NewPass@2026',
      });

      expect(usersService.updatePassword).toHaveBeenCalledWith(
        5,
        'NewPass@2026',
      );
      expect(refreshTokens.revokeAllByUserId).toHaveBeenCalledWith(5);
    });

    it('confirmPassword không khớp → 400 PASSWORD_MISMATCH (không đọc DB)', async () => {
      await expect(
        service.changePassword(5, {
          currentPassword: 'old',
          newPassword: 'NewPass@2026',
          confirmPassword: 'Different@2026',
        }),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: 'PASSWORD_MISMATCH' },
      });
      expect(usersService.findByIdWithPassword).not.toHaveBeenCalled();
    });

    it('sai mật khẩu hiện tại → 401 WRONG_CURRENT_PASSWORD', async () => {
      usersService.findByIdWithPassword.mockResolvedValue(makeUser());
      usersService.comparePassword.mockResolvedValue(false);

      await expect(
        service.changePassword(5, {
          currentPassword: 'wrong',
          newPassword: 'NewPass@2026',
          confirmPassword: 'NewPass@2026',
        }),
      ).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
        response: { code: 'WRONG_CURRENT_PASSWORD' },
      });
      expect(usersService.updatePassword).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------- forgot password --

  describe('forgotPassword', () => {
    it('email tồn tại → lưu hash token vào cache + gửi email', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser());

      await service.forgotPassword({ email: 'an.hoang@hrm.local' });

      expect(mailService.sendResetPasswordEmail).toHaveBeenCalledTimes(1);
      const args = mailService.sendResetPasswordEmail.mock.calls[0][0];
      expect(args.to).toBe('an.hoang@hrm.local');
      expect(args.expiresInMinutes).toBe(30);

      // Cache lưu SHA-256 hash, không lưu token thật.
      const payload = await cache.get<ResetTokenCachePayload>(
        resetTokenCacheKey(sha256Hex(args.rawToken)),
      );
      expect(payload?.userId).toBe(5);
    });

    it('email không tồn tại → không gửi mail nhưng KHÔNG ném lỗi (chống user enumeration)', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.forgotPassword({ email: 'nobody@hrm.local' }),
      ).resolves.toBeUndefined();
      expect(mailService.sendResetPasswordEmail).not.toHaveBeenCalled();
    });

    it('tài khoản không active → không gửi mail', async () => {
      usersService.findByEmail.mockResolvedValue(
        makeUser({ status: UserStatus.INACTIVE }),
      );

      await service.forgotPassword({ email: 'inactive.user@hrm.local' });

      expect(mailService.sendResetPasswordEmail).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------- reset password --

  describe('resetPassword', () => {
    async function issueResetToken(): Promise<string> {
      usersService.findByEmail.mockResolvedValue(makeUser());
      await service.forgotPassword({ email: 'an.hoang@hrm.local' });
      return mailService.sendResetPasswordEmail.mock.calls[0][0].rawToken;
    }

    it('token hợp lệ → đổi mật khẩu + revoke toàn bộ session + token dùng 1 lần', async () => {
      const token = await issueResetToken();
      usersService.findById.mockResolvedValue(makeUser());

      await service.resetPassword({
        token,
        newPassword: 'NewPass@2026',
        confirmPassword: 'NewPass@2026',
      });

      expect(usersService.updatePassword).toHaveBeenCalledWith(
        5,
        'NewPass@2026',
      );
      expect(refreshTokens.revokeAllByUserId).toHaveBeenCalledWith(5);

      // Lần 2 với cùng token → INVALID (đã bị xoá khỏi cache)
      await expect(
        service.resetPassword({
          token,
          newPassword: 'NewPass@2026',
          confirmPassword: 'NewPass@2026',
        }),
      ).rejects.toMatchObject({ response: { code: 'RESET_TOKEN_INVALID' } });
    });

    it('token sai → 400 RESET_TOKEN_INVALID', async () => {
      await expect(
        service.resetPassword({
          token: 'khong-ton-tai',
          newPassword: 'NewPass@2026',
          confirmPassword: 'NewPass@2026',
        }),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: 'RESET_TOKEN_INVALID' },
      });
    });

    it('token hết hạn → 400 RESET_TOKEN_EXPIRED (không phải INVALID)', async () => {
      const token = await issueResetToken();
      const key = resetTokenCacheKey(sha256Hex(token));
      const payload = await cache.get<ResetTokenCachePayload>(key);
      // Giả lập token đã quá 30 phút mà không cần chờ thật.
      await cache.set(key, {
        ...(payload as ResetTokenCachePayload),
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });

      await expect(
        service.resetPassword({
          token,
          newPassword: 'NewPass@2026',
          confirmPassword: 'NewPass@2026',
        }),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: 'RESET_TOKEN_EXPIRED' },
      });
      expect(usersService.updatePassword).not.toHaveBeenCalled();
      // Token hết hạn cũng bị xoá khỏi cache.
      await expect(cache.get(key)).resolves.toBeUndefined();
    });

    it('confirmPassword không khớp → 400 PASSWORD_MISMATCH', async () => {
      const token = await issueResetToken();

      await expect(
        service.resetPassword({
          token,
          newPassword: 'NewPass@2026',
          confirmPassword: 'Other@2026',
        }),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: 'PASSWORD_MISMATCH' },
      });
    });

    it('reset thành công xoá luôn trạng thái khoá đăng nhập', async () => {
      // Khoá tài khoản trước
      usersService.findByUsernameOrEmailWithPassword.mockResolvedValue(
        makeUser(),
      );
      usersService.comparePassword.mockResolvedValue(false);
      for (let i = 1; i <= 5; i++) {
        await expect(
          service.login({ username: 'an.hoang', password: 'wrong' }, CONTEXT),
        ).rejects.toBeDefined();
      }

      const token = await issueResetToken();
      usersService.findById.mockResolvedValue(makeUser());
      await service.resetPassword({
        token,
        newPassword: 'NewPass@2026',
        confirmPassword: 'NewPass@2026',
      });

      usersService.comparePassword.mockResolvedValue(true);
      await expect(
        service.login(
          { username: 'an.hoang', password: 'NewPass@2026' },
          CONTEXT,
        ),
      ).resolves.toMatchObject({ accessToken: 'signed.jwt' });
    });
  });

  // ---------------------------------------------------------------- profile --

  describe('getProfile', () => {
    it('trả về user shape giống login', async () => {
      usersService.findById.mockResolvedValue(makeUser());

      await expect(service.getProfile(5)).resolves.toEqual({
        id: 5,
        username: 'an.hoang',
        email: 'an.hoang@hrm.local',
        role: 'employee',
        employee: { id: 5, fullName: 'Hoàng Thị An', avatarUrl: null },
      });
    });

    it('user null employee → employee: null', async () => {
      usersService.findById.mockResolvedValue(
        makeUser({ employee: null, employeeId: null }),
      );

      await expect(service.getProfile(5)).resolves.toMatchObject({
        employee: null,
      });
    });

    it('user không còn tồn tại → 401 TOKEN_INVALID', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.getProfile(5)).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
        response: { code: 'TOKEN_INVALID' },
      });
    });
  });
});
