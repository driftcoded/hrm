import * as request from 'supertest';
import { App } from 'supertest/types';
import { sha256Hex } from '@/common/utils/hash.util';
import {
  createE2eApp,
  E2eContext,
  errorBody,
  extractRefreshCookie,
  findRefreshCookieHeader,
  findRefreshTokenRowByHash,
  findRefreshTokenRows,
  getUserIdByUsername,
  insertExpiredRefreshToken,
  loginData,
  refreshData,
  resetAuthState,
  SEED_PASSWORD,
  SEED_USERS,
  userData,
} from './support/e2e-app';

/**
 * e2e cho checklist PLAN.md 1.1 (mục 1-10) – chạy trên app thật + DB hrm_dev thật.
 * Yêu cầu: đã chạy `npm run migration:run` và `npm run seed`.
 */
describe('Auth (e2e) – login / refresh / logout / session', () => {
  let context: E2eContext;
  let server: App;

  beforeAll(async () => {
    context = await createE2eApp();
    server = context.app.getHttpServer() as App;
    await resetAuthState(context, { restorePasswords: true });
  });

  afterAll(async () => {
    await resetAuthState(context, { restorePasswords: true });
    await context.app.close();
  });

  beforeEach(async () => {
    // Mỗi test bắt đầu từ state sạch: không counter lockout, không session cũ.
    await resetAuthState(context);
  });

  /** Path hẹp của cookie refresh token, khớp RefreshCookieService.cookiePath. */
  const REFRESH_COOKIE_PATH = '/api/v1/auth/refresh';

  const login = (body: Record<string, unknown>) =>
    request(server).post('/api/v1/auth/login').send(body);

  // ---- 1. Login đúng → access token + cookie -------------------------------
  it('[1] login đúng → 200, trả accessToken + set cookie refresh token HttpOnly/SameSite=Strict', async () => {
    const response = await login({
      username: SEED_USERS.admin,
      password: SEED_PASSWORD,
    }).expect(200);

    expect(response.body).toMatchObject({ success: true });

    const data = loginData(response);
    expect(data.expiresIn).toBe(900);
    expect(data.user.username).toBe('admin');
    expect(data.user.role).toBe('admin');
    expect(typeof data.user.employee?.id).toBe('number');
    expect(typeof data.user.employee?.fullName).toBe('string');
    expect(typeof data.accessToken).toBe('string');
    // Refresh token KHÔNG được trả trong body (chỉ nằm trong cookie).
    expect(loginData(response)).not.toHaveProperty('refreshToken');

    const cookieHeader = findRefreshCookieHeader(
      response.headers['set-cookie'],
    );
    expect(cookieHeader).toBeDefined();
    expect(cookieHeader).toContain('HttpOnly');
    expect(cookieHeader).toContain('SameSite=Strict');
    // NODE_ENV=development → KHÔNG có Secure (nếu có, browser sẽ bỏ cookie trên http://localhost).
    expect(cookieHeader).not.toContain('Secure');
    // rememberMe mặc định false → session cookie (không Max-Age/Expires).
    expect(cookieHeader).not.toContain('Max-Age');
    // Path HẸP: cookie chỉ được browser gửi tới đúng endpoint refresh, không phải
    // mọi request tới origin (regression test cho fix bảo mật path=/).
    expect(cookieHeader).toContain(`Path=${REFRESH_COOKIE_PATH}`);
    expect(cookieHeader).not.toMatch(/Path=\/;/);

    const rawToken = extractRefreshCookie(response.headers['set-cookie']);
    const stored = await findRefreshTokenRowByHash(
      context,
      sha256Hex(rawToken!),
    );
    expect(stored).toBeDefined();
    expect(stored?.revoked_at).toBeNull();
    // DB chỉ lưu SHA-256 hash, không lưu token thật.
    expect(stored?.token_hash).not.toBe(rawToken);
  });

  it('[1b] login bằng EMAIL (không phân biệt hoa/thường) cũng hợp lệ', async () => {
    const response = await login({
      username: 'AN.HOANG@HRM.LOCAL',
      password: SEED_PASSWORD,
    }).expect(200);

    expect(loginData(response).user.username).toBe(SEED_USERS.employeeA);
  });

  it('[1c] rememberMe = true → cookie persistent có Max-Age 7 ngày', async () => {
    const response = await login({
      username: SEED_USERS.admin,
      password: SEED_PASSWORD,
      rememberMe: true,
    }).expect(200);

    const cookieHeader = findRefreshCookieHeader(
      response.headers['set-cookie'],
    );
    expect(cookieHeader).toContain('Max-Age=604800');
  });

  it('[1d] login thành công cập nhật users.last_login_at', async () => {
    const userId = await getUserIdByUsername(context, SEED_USERS.hrStaff);
    await context.dataSource.query(
      'UPDATE users SET last_login_at = NULL WHERE id = ?',
      [userId],
    );

    await login({
      username: SEED_USERS.hrStaff,
      password: SEED_PASSWORD,
    }).expect(200);

    const rows = await context.dataSource.query<Array<{ last_login_at: Date }>>(
      'SELECT last_login_at FROM users WHERE id = ?',
      [userId],
    );
    expect(rows[0].last_login_at).not.toBeNull();
  });

  // ---- 2. Login sai mật khẩu → 401 ----------------------------------------
  it('[2] login sai mật khẩu → 401 INVALID_CREDENTIALS với message rõ ràng', async () => {
    const response = await login({
      username: SEED_USERS.admin,
      password: 'SaiMatKhau1',
    }).expect(401);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid username/email or password',
      },
    });
    expect(errorBody(response).error).not.toHaveProperty('details');
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('[2b] username không tồn tại → cũng 401 INVALID_CREDENTIALS (không tiết lộ)', async () => {
    const response = await login({
      username: 'khong.ton.tai',
      password: 'SaiMatKhau1',
    }).expect(401);

    expect(errorBody(response).error.code).toBe('INVALID_CREDENTIALS');
  });

  it('[2c] tài khoản status=locked → 423, status=inactive → 403', async () => {
    const lockedResponse = await login({
      username: SEED_USERS.locked,
      password: SEED_PASSWORD,
    }).expect(423);
    expect(errorBody(lockedResponse).error.code).toBe('ACCOUNT_LOCKED');

    const inactiveResponse = await login({
      username: SEED_USERS.inactive,
      password: SEED_PASSWORD,
    }).expect(403);
    expect(errorBody(inactiveResponse).error.code).toBe('ACCOUNT_INACTIVE');
  });

  // ---- 3 & 4. Lockout ------------------------------------------------------
  it('[3][4] sai 5 lần → 429 (khoá 15 phút); lần sau → 423 kèm thời gian còn lại', async () => {
    const username = SEED_USERS.employeeB;

    for (let attempt = 1; attempt <= 4; attempt++) {
      const response = await login({ username, password: 'SaiMatKhau1' });
      expect(response.status).toBe(401);
      expect(errorBody(response).error.code).toBe('INVALID_CREDENTIALS');
    }

    // Lần sai thứ 5 = lần "trip" khoá tài khoản → 429
    const tripResponse = await login({ username, password: 'SaiMatKhau1' });
    expect(tripResponse.status).toBe(429);
    expect(errorBody(tripResponse).error.code).toBe('ACCOUNT_LOCKED');
    expect(errorBody(tripResponse).error.message).toContain(
      'locked for 15 minutes',
    );

    // Lần tiếp theo (kể cả mật khẩu ĐÚNG) → 423 + thời gian còn lại
    const lockedResponse = await login({ username, password: SEED_PASSWORD });
    expect(lockedResponse.status).toBe(423);
    expect(errorBody(lockedResponse).error.code).toBe('ACCOUNT_LOCKED');
    expect(errorBody(lockedResponse).error.message).toMatch(
      /Try again in 15 minute\(s\) \(\d+s remaining\)/,
    );

    // Thời gian còn lại PHẢI đọc được bằng máy: `error.message` là text tiếng
    // Anh cho developer, frontend không được hiện ra cho user nên không thể
    // parse chuỗi đó. Header `Retry-After` là kênh duy nhất đúng chuẩn.
    for (const response of [tripResponse, lockedResponse]) {
      const retryAfter = Number(response.headers['retry-after']);
      expect(Number.isFinite(retryAfter)).toBe(true);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(15 * 60);
    }

    // ...và KHÔNG được lọt vào body: envelope phải đúng api-spec.md §1.1.
    expect(errorBody(lockedResponse).error).not.toHaveProperty(
      'retryAfterSeconds',
    );
  });

  it('[3b] login thành công reset counter (4 lần sai rồi đúng → không bị khoá)', async () => {
    const username = SEED_USERS.employeeB;

    for (let attempt = 1; attempt <= 4; attempt++) {
      await login({ username, password: 'SaiMatKhau1' }).expect(401);
    }

    await login({ username, password: SEED_PASSWORD }).expect(200);

    for (let attempt = 1; attempt <= 4; attempt++) {
      await login({ username, password: 'SaiMatKhau1' }).expect(401);
    }
    await login({ username, password: 'SaiMatKhau1' }).expect(429);
  });

  // ---- 5. Request không có token → 401 ------------------------------------
  it('[5] request endpoint cần auth mà không có token → 401 TOKEN_INVALID', async () => {
    const noToken = await request(server).get('/api/v1/auth/me').expect(401);
    expect(errorBody(noToken).error.code).toBe('TOKEN_INVALID');

    const badToken = await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer khong-phai-jwt')
      .expect(401);
    expect(errorBody(badToken).error.code).toBe('TOKEN_INVALID');

    await request(server).post('/api/v1/auth/logout').expect(401);
    await request(server)
      .post('/api/v1/auth/change-password')
      .send({})
      .expect(401);
  });

  it('[5b] có token hợp lệ → GET /auth/me trả đúng user (dùng để dựng lại session sau F5)', async () => {
    const loginResponse = await login({
      username: SEED_USERS.employeeA,
      password: SEED_PASSWORD,
    }).expect(200);

    const me = await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginData(loginResponse).accessToken}`)
      .expect(200);

    expect(userData(me)).toEqual(loginData(loginResponse).user);
  });

  // ---- 6. Refresh hợp lệ → rotation --------------------------------------
  it('[6] refresh hợp lệ → access token mới + cookie mới, token cũ bị revoke ngay', async () => {
    const loginResponse = await login({
      username: SEED_USERS.admin,
      password: SEED_PASSWORD,
    }).expect(200);

    const oldCookie = extractRefreshCookie(
      loginResponse.headers['set-cookie'],
    )!;

    const refreshResponse = await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${oldCookie}`)
      .expect(200);

    expect(typeof refreshData(refreshResponse).accessToken).toBe('string');
    expect(refreshData(refreshResponse).expiresIn).toBe(900);

    const newCookie = extractRefreshCookie(
      refreshResponse.headers['set-cookie'],
    )!;
    expect(newCookie).not.toBe(oldCookie);

    const oldRow = await findRefreshTokenRowByHash(
      context,
      sha256Hex(oldCookie),
    );
    const newRow = await findRefreshTokenRowByHash(
      context,
      sha256Hex(newCookie),
    );
    expect(oldRow?.revoked_at).not.toBeNull();
    expect(newRow?.revoked_at).toBeNull();

    // Token mới dùng được ngay
    await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${newCookie}`)
      .expect(200);
  });

  it('[6c] cookie refresh token luôn có Path hẹp = endpoint refresh (login + refresh + logout)', async () => {
    const loginResponse = await login({
      username: SEED_USERS.admin,
      password: SEED_PASSWORD,
      rememberMe: true,
    }).expect(200);

    expect(
      findRefreshCookieHeader(loginResponse.headers['set-cookie']),
    ).toContain(`Path=${REFRESH_COOKIE_PATH}`);

    const cookie = extractRefreshCookie(loginResponse.headers['set-cookie'])!;
    const refreshResponse = await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${cookie}`)
      .expect(200);

    expect(
      findRefreshCookieHeader(refreshResponse.headers['set-cookie']),
    ).toContain(`Path=${REFRESH_COOKIE_PATH}`);

    // clearCookie chỉ xoá được cookie khi Path khớp lúc set.
    const logoutResponse = await request(server)
      .post('/api/v1/auth/logout')
      .set(
        'Authorization',
        `Bearer ${refreshData(refreshResponse).accessToken}`,
      )
      .expect(200);

    expect(
      findRefreshCookieHeader(logoutResponse.headers['set-cookie']),
    ).toContain(`Path=${REFRESH_COOKIE_PATH}`);
  });

  it('[6b] refresh không có cookie → 401 TOKEN_INVALID', async () => {
    const response = await request(server)
      .post('/api/v1/auth/refresh')
      .expect(401);

    expect(errorBody(response).error.code).toBe('TOKEN_INVALID');
  });

  // ---- 7. Refresh token hết hạn → 401 ------------------------------------
  it('[7] refresh token đã hết hạn → 401 REFRESH_TOKEN_EXPIRED (seed row expires_at trong quá khứ)', async () => {
    const userId = await getUserIdByUsername(context, SEED_USERS.admin);
    const expiredToken = 's.expired-token-for-e2e-test';
    await insertExpiredRefreshToken(context, userId, sha256Hex(expiredToken));

    const response = await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${expiredToken}`)
      .expect(401);

    expect(errorBody(response).error.code).toBe('REFRESH_TOKEN_EXPIRED');
  });

  // ---- 8. Dùng lại token đã revoke → 401 + revoke toàn bộ session --------
  it('[8] dùng lại refresh token đã revoke → 401 và revoke TOÀN BỘ session của user', async () => {
    const userId = await getUserIdByUsername(context, SEED_USERS.admin);

    // 2 session độc lập
    const first = await login({
      username: SEED_USERS.admin,
      password: SEED_PASSWORD,
    }).expect(200);
    const second = await login({
      username: SEED_USERS.admin,
      password: SEED_PASSWORD,
    }).expect(200);

    const firstCookie = extractRefreshCookie(first.headers['set-cookie'])!;
    const secondCookie = extractRefreshCookie(second.headers['set-cookie'])!;

    // Rotation session 1 → token cũ bị revoke
    const rotated = await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${firstCookie}`)
      .expect(200);
    const rotatedCookie = extractRefreshCookie(rotated.headers['set-cookie'])!;

    // Dùng lại token đã revoke → 401
    const reuse = await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${firstCookie}`)
      .expect(401);
    expect(errorBody(reuse).error.code).toBe('TOKEN_INVALID');

    // Toàn bộ session của user bị revoke (kể cả session 2 và token vừa rotate)
    const rows = await findRefreshTokenRows(context, userId);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.every((row) => row.revoked_at !== null)).toBe(true);

    await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${secondCookie}`)
      .expect(401);
    await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${rotatedCookie}`)
      .expect(401);
  });

  // ---- 9. Logout ----------------------------------------------------------
  it('[9] logout (chỉ cần access token, KHÔNG gửi cookie) → cookie bị xoá + refresh token trong DB bị revoke', async () => {
    const loginResponse = await login({
      username: SEED_USERS.manager,
      password: SEED_PASSWORD,
    }).expect(200);

    const cookie = extractRefreshCookie(loginResponse.headers['set-cookie'])!;
    const accessToken = loginData(loginResponse).accessToken;

    // Cookie refresh token bị giới hạn Path=/api/v1/auth/refresh nên request
    // logout của browser KHÔNG mang cookie: session được xác định qua claim sid.
    const logoutResponse = await request(server)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const clearHeader = findRefreshCookieHeader(
      logoutResponse.headers['set-cookie'],
    );
    expect(clearHeader).toBeDefined();
    // clearCookie gửi giá trị rỗng + Expires trong quá khứ.
    expect(clearHeader).toMatch(/^refresh_token=;/);
    expect(clearHeader).toContain('Expires=Thu, 01 Jan 1970');
    expect(clearHeader).toContain('HttpOnly');
    // Path của lệnh xoá PHẢI khớp Path lúc set, nếu không browser sẽ không xoá.
    expect(clearHeader).toContain(`Path=${REFRESH_COOKIE_PATH}`);

    const row = await findRefreshTokenRowByHash(context, sha256Hex(cookie));
    expect(row?.revoked_at).not.toBeNull();

    // Cookie cũ không dùng lại được
    await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${cookie}`)
      .expect(401);
  });

  // ---- 10. Giới hạn 5 session --------------------------------------------
  it('[10] login lần thứ 6 → session cũ nhất bị kick, 5 session mới nhất còn sống', async () => {
    const userId = await getUserIdByUsername(context, SEED_USERS.hrManager);
    const cookies: string[] = [];

    for (let index = 0; index < 6; index++) {
      const response = await login({
        username: SEED_USERS.hrManager,
        password: SEED_PASSWORD,
      }).expect(200);
      cookies.push(extractRefreshCookie(response.headers['set-cookie'])!);
    }

    const rows = await findRefreshTokenRows(context, userId);
    expect(rows).toHaveLength(6);
    const active = rows.filter((row) => row.revoked_at === null);
    expect(active).toHaveLength(5);

    // Session đầu tiên (cũ nhất) chính là session bị kick.
    const oldestRow = await findRefreshTokenRowByHash(
      context,
      sha256Hex(cookies[0]),
    );
    expect(oldestRow?.revoked_at).not.toBeNull();

    // Session mới nhất vẫn refresh được.
    await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${cookies[5]}`)
      .expect(200);
  });
});
