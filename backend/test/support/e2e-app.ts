import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as cookieParser from 'cookie-parser';
import { readdir, readFile, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { AppModule } from '@/app.module';
import { validationExceptionFactory } from '@/common/pipes/validation-exception.factory';
import { CacheService } from '@/shared/cache/cache.service';

/**
 * Supertest trả `response.body` kiểu `any`. Các helper dưới đây ép về đúng
 * envelope chuẩn (api-spec.md §1.1) để assertion vẫn được type-check.
 */
export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; code: string; message: string }>;
  };
  timestamp: string;
}

export interface AuthUserBody {
  id: number;
  username: string;
  email: string;
  role: string;
  employee: { id: number; fullName: string; avatarUrl: string | null } | null;
}

export interface LoginBody {
  accessToken: string;
  expiresIn: number;
  user: AuthUserBody;
}

export interface RefreshBody {
  accessToken: string;
  expiresIn: number;
}

export interface OkBody {
  ok: boolean;
}

interface ResponseLike {
  body: unknown;
}

export function successBody<T>(response: ResponseLike): ApiSuccessEnvelope<T> {
  return response.body as ApiSuccessEnvelope<T>;
}

export function errorBody(response: ResponseLike): ApiErrorEnvelope {
  return response.body as ApiErrorEnvelope;
}

export const loginData = (response: ResponseLike): LoginBody =>
  successBody<LoginBody>(response).data;

export const refreshData = (response: ResponseLike): RefreshBody =>
  successBody<RefreshBody>(response).data;

export const userData = (response: ResponseLike): AuthUserBody =>
  successBody<AuthUserBody>(response).data;

export const okData = (response: ResponseLike): OkBody =>
  successBody<OkBody>(response).data;

/**
 * Mật khẩu của toàn bộ tài khoản seed (xem src/database/seeds/users.seed.ts).
 *
 * Không có fallback hardcode: seed cũng bắt buộc `SEED_DEFAULT_PASSWORD`, nên
 * một giá trị mặc định ở đây chỉ khiến test fail muộn với lỗi 401 khó hiểu thay
 * vì báo ngay là thiếu cấu hình.
 */
const seedPassword = process.env.SEED_DEFAULT_PASSWORD;

if (!seedPassword) {
  throw new Error(
    'E2E cần SEED_DEFAULT_PASSWORD (khớp với mật khẩu đã seed). Đặt trong .env — xem .env.example.',
  );
}

export const SEED_PASSWORD: string = seedPassword;

/** Tài khoản seed dùng trong e2e test. */
export const SEED_USERS = {
  admin: 'admin',
  hrManager: 'hr.manager',
  hrStaff: 'hr.staff',
  manager: 'manager',
  employeeA: 'an.hoang',
  employeeB: 'binh.vu',
  locked: 'locked.user',
  inactive: 'inactive.user',
} as const;

export const SEED_USERNAMES: string[] = Object.values(SEED_USERS);

export interface E2eContext {
  app: INestApplication;
  dataSource: DataSource;
  cache: CacheService;
}

/**
 * Bootstrap app thật (AppModule + DB hrm_dev thật) với cùng cấu hình global như
 * main.ts: cookie-parser, ValidationPipe, global prefix /api/v1.
 * Guard/Interceptor/Filter global đã nằm trong AppModule nên tự áp dụng.
 */
export async function createE2eApp(): Promise<E2eContext> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication({ logger: false });

  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: validationExceptionFactory,
    }),
  );

  await app.init();

  return {
    app,
    dataSource: app.get(DataSource),
    cache: app.get(CacheService),
  };
}

/**
 * Đưa state về mốc sạch để test chạy lại được nhiều lần:
 * xoá refresh token của các tài khoản seed, xoá cache (counter lockout, reset
 * token) và (tuỳ chọn) đặt lại mật khẩu seed.
 */
export async function resetAuthState(
  context: E2eContext,
  options: { restorePasswords?: boolean } = {},
): Promise<void> {
  await context.cache.reset();

  await cleanupSeedRefreshTokens(context.dataSource);

  if (options.restorePasswords) {
    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
    await context.dataSource.query(
      `UPDATE users SET password = ? WHERE username IN (?)`,
      [passwordHash, SEED_USERNAMES],
    );
  }
}

/**
 * Xoá toàn bộ refresh token của các tài khoản seed. Dùng ở teardown để không
 * để lại session rác trong DB dùng chung với server dev của người dùng.
 */
export async function cleanupSeedRefreshTokens(
  dataSource: DataSource,
): Promise<void> {
  await dataSource.query(
    `DELETE rt FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE u.username IN (?)`,
    [SEED_USERNAMES],
  );
}

export async function getUserIdByUsername(
  context: E2eContext,
  username: string,
): Promise<number> {
  const rows = await context.dataSource.query<Array<{ id: string }>>(
    `SELECT id FROM users WHERE username = ? LIMIT 1`,
    [username],
  );

  if (rows.length === 0) {
    throw new Error(
      `Không tìm thấy user seed "${username}". Chạy \`npm run seed\` trước khi test e2e.`,
    );
  }

  return Number(rows[0].id);
}

export interface RefreshTokenRow {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

export async function findRefreshTokenRows(
  context: E2eContext,
  userId: number,
): Promise<RefreshTokenRow[]> {
  return context.dataSource.query<RefreshTokenRow[]>(
    `SELECT id, user_id, token_hash, expires_at, revoked_at, created_at
     FROM refresh_tokens WHERE user_id = ? ORDER BY id ASC`,
    [userId],
  );
}

export async function findRefreshTokenRowByHash(
  context: E2eContext,
  tokenHash: string,
): Promise<RefreshTokenRow | undefined> {
  const rows = await context.dataSource.query<RefreshTokenRow[]>(
    `SELECT id, user_id, token_hash, expires_at, revoked_at, created_at
     FROM refresh_tokens WHERE token_hash = ? LIMIT 1`,
    [tokenHash],
  );

  return rows[0];
}

/** Chèn trực tiếp 1 refresh token ĐÃ HẾT HẠN – test expiry không phải chờ thật. */
export async function insertExpiredRefreshToken(
  context: E2eContext,
  userId: number,
  tokenHash: string,
): Promise<void> {
  await context.dataSource.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, device, ip_address, expires_at, created_at)
     VALUES (?, ?, 'jest', '127.0.0.1', DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 8 DAY))`,
    [userId, tokenHash],
  );
}

/** Lấy giá trị cookie refresh_token từ header Set-Cookie của response. */
export function extractRefreshCookie(
  setCookieHeader: string[] | string | undefined,
): string | undefined {
  const headers = normalizeSetCookie(setCookieHeader);
  const cookie = headers.find((value) => value.startsWith('refresh_token='));

  if (!cookie) {
    return undefined;
  }

  const value = cookie.split(';')[0].slice('refresh_token='.length);
  return value.length > 0 ? value : undefined;
}

/** Trả về nguyên chuỗi Set-Cookie của refresh_token (để assert flag). */
export function findRefreshCookieHeader(
  setCookieHeader: string[] | string | undefined,
): string | undefined {
  return normalizeSetCookie(setCookieHeader).find((value) =>
    value.startsWith('refresh_token='),
  );
}

function normalizeSetCookie(
  setCookieHeader: string[] | string | undefined,
): string[] {
  if (!setCookieHeader) {
    return [];
  }

  return Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
}

/**
 * Đọc token reset password từ email mà dev mail transport đã ghi ra
 * `logs/mail/*.html` (transport dev – KHÔNG gửi qua SES thật).
 */
export async function readResetTokenFromDevMail(
  recipientEmail: string,
  writtenAfter: number,
): Promise<{ token: string; filePath: string; content: string }> {
  const dir = resolve(
    process.cwd(),
    process.env.MAIL_DEV_OUTPUT_DIR ?? 'logs/mail',
  );
  const safeRecipient = recipientEmail.replace(/[^a-zA-Z0-9._-]/g, '_');
  const entries = await readdir(dir, { withFileTypes: true });

  const candidates: Array<{ filePath: string; mtimeMs: number }> = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.includes(safeRecipient)) {
      continue;
    }

    const filePath = join(dir, entry.name);
    const stats = await stat(filePath);
    candidates.push({ filePath, mtimeMs: stats.mtimeMs });
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const candidate of candidates) {
    // Chỉ nhận email được ghi trong lượt test hiện tại (trừ 2s sai số fs).
    if (candidate.mtimeMs < writtenAfter - 2000) {
      break;
    }

    const content = await readFile(candidate.filePath, 'utf8');
    const match = /reset-password\?token=([a-f0-9]{64})/.exec(content);

    if (match) {
      return { token: match[1], filePath: candidate.filePath, content };
    }
  }

  throw new Error(
    `Không tìm thấy email reset password cho ${recipientEmail} trong ${dir}`,
  );
}
