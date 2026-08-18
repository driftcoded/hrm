import * as request from 'supertest';
import { App } from 'supertest/types';
import { sha256Hex } from '@/common/utils/hash.util';
import {
  resetTokenCacheKey,
  ResetTokenCachePayload,
} from '@/modules/auth/auth.constants';
import {
  createE2eApp,
  E2eContext,
  errorBody,
  extractRefreshCookie,
  findRefreshTokenRows,
  getUserIdByUsername,
  loginData,
  okData,
  readResetTokenFromDevMail,
  resetAuthState,
  SEED_PASSWORD,
  SEED_USERS,
} from './support/e2e-app';

/**
 * e2e cho checklist PLAN.md 1.1 (mục 11-13) + change-password.
 *
 * Email được kiểm tra qua **dev mail transport** (ghi file HTML vào logs/mail),
 * KHÔNG qua AWS SES thật – dự án chưa có credentials SES.
 */
describe('Auth (e2e) – change / forgot / reset password', () => {
  let context: E2eContext;
  let server: App;

  beforeAll(async () => {
    context = await createE2eApp();
    server = context.app.getHttpServer() as App;
    await resetAuthState(context, { restorePasswords: true });
  });

  afterAll(async () => {
    // Trả mật khẩu seed về mốc ban đầu để test chạy lại được nhiều lần.
    await resetAuthState(context, { restorePasswords: true });
    await context.app.close();
  });

  beforeEach(async () => {
    await resetAuthState(context, { restorePasswords: true });
  });

  const login = (username: string, password: string) =>
    request(server).post('/api/v1/auth/login').send({ username, password });

  // ---- change-password ----------------------------------------------------
  describe('POST /auth/change-password', () => {
    it('đổi mật khẩu thành công → login bằng mật khẩu mới, toàn bộ session bị revoke', async () => {
      const username = SEED_USERS.employeeA;
      const userId = await getUserIdByUsername(context, username);
      const newPassword = 'DoiMatKhau@2026';

      const first = await login(username, SEED_PASSWORD).expect(200);
      const second = await login(username, SEED_PASSWORD).expect(200);
      const secondCookie = extractRefreshCookie(second.headers['set-cookie'])!;

      await request(server)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${loginData(first).accessToken}`)
        .send({
          currentPassword: SEED_PASSWORD,
          newPassword,
          confirmPassword: newPassword,
        })
        .expect(200);

      const rows = await findRefreshTokenRows(context, userId);
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows.every((row) => row.revoked_at !== null)).toBe(true);

      // Session cũ không refresh được nữa
      await request(server)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refresh_token=${secondCookie}`)
        .expect(401);

      await login(username, SEED_PASSWORD).expect(401);
      await login(username, newPassword).expect(200);
    });

    it('confirmPassword không khớp → 400 PASSWORD_MISMATCH', async () => {
      const loginResponse = await login(
        SEED_USERS.employeeA,
        SEED_PASSWORD,
      ).expect(200);

      const response = await request(server)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${loginData(loginResponse).accessToken}`)
        .send({
          currentPassword: SEED_PASSWORD,
          newPassword: 'DoiMatKhau@2026',
          confirmPassword: 'KhongKhop@2026',
        })
        .expect(400);

      expect(errorBody(response).error.code).toBe('PASSWORD_MISMATCH');
      await login(SEED_USERS.employeeA, SEED_PASSWORD).expect(200);
    });

    it('sai mật khẩu hiện tại → 401 WRONG_CURRENT_PASSWORD', async () => {
      const loginResponse = await login(
        SEED_USERS.employeeA,
        SEED_PASSWORD,
      ).expect(200);

      const response = await request(server)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${loginData(loginResponse).accessToken}`)
        .send({
          currentPassword: 'SaiHoanToan1',
          newPassword: 'DoiMatKhau@2026',
          confirmPassword: 'DoiMatKhau@2026',
        })
        .expect(401);

      expect(errorBody(response).error.code).toBe('WRONG_CURRENT_PASSWORD');
    });

    it('mật khẩu mới ngắn hơn 8 ký tự → 400 VALIDATION_ERROR kèm details[]', async () => {
      const loginResponse = await login(
        SEED_USERS.employeeA,
        SEED_PASSWORD,
      ).expect(200);

      const response = await request(server)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${loginData(loginResponse).accessToken}`)
        .send({
          currentPassword: SEED_PASSWORD,
          newPassword: 'short',
          confirmPassword: 'short',
        })
        .expect(400);

      expect(errorBody(response).error.code).toBe('VALIDATION_ERROR');
      expect(errorBody(response).error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'newPassword',
            code: 'INVALID_LENGTH',
          }),
        ]),
      );
    });
  });

  // ---- 11. Forgot password → email được gửi ------------------------------
  describe('POST /auth/forgot-password', () => {
    it('[11] email tồn tại → dev mail transport ghi file HTML chứa link reset', async () => {
      const startedAt = Date.now();

      await request(server)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'an.hoang@hrm.local' })
        .expect(200)
        .expect((response) => {
          expect(response.body).toMatchObject({
            success: true,
            data: { ok: true },
          });
        });

      const mail = await readResetTokenFromDevMail(
        'an.hoang@hrm.local',
        startedAt,
      );

      expect(mail.filePath).toMatch(
        /logs[\\/]mail[\\/].*an\.hoang_hrm\.local\.html$/,
      );
      expect(mail.content).toContain('Đặt lại mật khẩu');
      expect(mail.content).toContain(
        `http://localhost:5173/reset-password?token=${mail.token}`,
      );

      // Cache lưu hash của token, không lưu token thật.
      const payload = await context.cache.get<ResetTokenCachePayload>(
        resetTokenCacheKey(sha256Hex(mail.token)),
      );
      expect(payload).toBeDefined();
      expect(payload?.userId).toBe(
        await getUserIdByUsername(context, SEED_USERS.employeeA),
      );
    });

    it('[11b] email không tồn tại → response Y NGUYÊN như email tồn tại (chống user enumeration)', async () => {
      const existing = await request(server)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'an.hoang@hrm.local' })
        .expect(200);

      const unknown = await request(server)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'khong-ton-tai@hrm.local' })
        .expect(200);

      expect(okData(unknown)).toEqual(okData(existing));
      expect(unknown.status).toBe(existing.status);
    });

    it('[11c] email sai định dạng → 400 VALIDATION_ERROR', async () => {
      const response = await request(server)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'khong-phai-email' })
        .expect(400);

      expect(errorBody(response).error.code).toBe('VALIDATION_ERROR');
      expect(errorBody(response).error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'email', code: 'INVALID_EMAIL' }),
        ]),
      );
    });
  });

  // ---- 12 & 13. Reset password -------------------------------------------
  describe('POST /auth/reset-password', () => {
    async function requestResetToken(email: string): Promise<string> {
      const startedAt = Date.now();
      await request(server)
        .post('/api/v1/auth/forgot-password')
        .send({ email })
        .expect(200);

      const mail = await readResetTokenFromDevMail(email, startedAt);
      return mail.token;
    }

    it('[12] token hợp lệ → đổi được mật khẩu, token dùng 1 lần, session bị revoke', async () => {
      const username = SEED_USERS.employeeB;
      const userId = await getUserIdByUsername(context, username);
      const newPassword = 'ResetMoi@2026';

      const session = await login(username, SEED_PASSWORD).expect(200);
      const cookie = extractRefreshCookie(session.headers['set-cookie'])!;

      const token = await requestResetToken('binh.vu@hrm.local');

      await request(server)
        .post('/api/v1/auth/reset-password')
        .send({ token, newPassword, confirmPassword: newPassword })
        .expect(200);

      await login(username, newPassword).expect(200);
      await login(username, SEED_PASSWORD).expect(401);

      const rows = await findRefreshTokenRows(context, userId);
      expect(rows.some((row) => row.revoked_at !== null)).toBe(true);
      await request(server)
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refresh_token=${cookie}`)
        .expect(401);

      // Token dùng lần 2 → INVALID
      const reuse = await request(server)
        .post('/api/v1/auth/reset-password')
        .send({ token, newPassword, confirmPassword: newPassword })
        .expect(400);
      expect(errorBody(reuse).error.code).toBe('RESET_TOKEN_INVALID');
    });

    it('[13] token hết hạn → 400 RESET_TOKEN_EXPIRED (đẩy expiresAt về quá khứ, không chờ 30 phút)', async () => {
      const token = await requestResetToken('binh.vu@hrm.local');
      const cacheKey = resetTokenCacheKey(sha256Hex(token));
      const payload = await context.cache.get<ResetTokenCachePayload>(cacheKey);
      expect(payload).toBeDefined();

      await context.cache.set(cacheKey, {
        ...(payload as ResetTokenCachePayload),
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      });

      const response = await request(server)
        .post('/api/v1/auth/reset-password')
        .send({
          token,
          newPassword: 'ResetMoi@2026',
          confirmPassword: 'ResetMoi@2026',
        })
        .expect(400);

      expect(errorBody(response).error.code).toBe('RESET_TOKEN_EXPIRED');
      // Mật khẩu KHÔNG bị đổi
      await login(SEED_USERS.employeeB, SEED_PASSWORD).expect(200);
    });

    it('[13b] token không tồn tại → 400 RESET_TOKEN_INVALID', async () => {
      const response = await request(server)
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'a'.repeat(64),
          newPassword: 'ResetMoi@2026',
          confirmPassword: 'ResetMoi@2026',
        })
        .expect(400);

      expect(errorBody(response).error.code).toBe('RESET_TOKEN_INVALID');
    });

    it('[13c] confirmPassword không khớp → 400 PASSWORD_MISMATCH', async () => {
      const token = await requestResetToken('binh.vu@hrm.local');

      const response = await request(server)
        .post('/api/v1/auth/reset-password')
        .send({
          token,
          newPassword: 'ResetMoi@2026',
          confirmPassword: 'KhacHoanToan@2026',
        })
        .expect(400);

      expect(errorBody(response).error.code).toBe('PASSWORD_MISMATCH');
      await login(SEED_USERS.employeeB, SEED_PASSWORD).expect(200);
    });

    it('[13d] reset password xoá luôn trạng thái khoá do login sai 5 lần', async () => {
      const username = SEED_USERS.employeeB;
      const newPassword = 'ResetMoi@2026';

      for (let attempt = 1; attempt <= 4; attempt++) {
        await login(username, 'SaiMatKhau1').expect(401);
      }
      await login(username, 'SaiMatKhau1').expect(429);
      await login(username, SEED_PASSWORD).expect(423);

      const token = await requestResetToken('binh.vu@hrm.local');
      await request(server)
        .post('/api/v1/auth/reset-password')
        .send({ token, newPassword, confirmPassword: newPassword })
        .expect(200);

      await login(username, newPassword).expect(200);
    });
  });
});
