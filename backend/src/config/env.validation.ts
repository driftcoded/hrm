import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:5173'),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(3306),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_DATABASE: Joi.string().required(),

  // JWT secret must be >= 64 characters (>= 256-bit entropy if random hex).
  // The app fails fast at bootstrap if the secret is missing or too weak.
  JWT_SECRET: Joi.string().min(64).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // ---- Auth policy ----
  AUTH_MAX_FAILED_LOGIN_ATTEMPTS: Joi.number().integer().min(1).default(5),
  AUTH_LOCKOUT_MINUTES: Joi.number().integer().min(1).default(15),
  AUTH_MAX_CONCURRENT_SESSIONS: Joi.number().integer().min(1).default(5),
  AUTH_RESET_TOKEN_TTL_MINUTES: Joi.number().integer().min(1).default(30),
  AUTH_REFRESH_COOKIE_NAME: Joi.string().default('refresh_token'),

  // ---- Mail ----
  // 'smtp' reads host/port/credentials from system_mail_settings (DB), set by
  // an admin via /settings/mail — never from env vars.
  MAIL_TRANSPORT: Joi.string().valid('dev', 'smtp').default('dev'),
  MAIL_FROM: Joi.string().default('no-reply@company.local'),
  MAIL_FROM_NAME: Joi.string().default('HRM System'),
  MAIL_DEV_OUTPUT_DIR: Joi.string().default('logs/mail'),
  AWS_REGION: Joi.string().default('ap-southeast-1'),

  // ---- Settings encryption ----
  // 32-byte AES-256 key (64 hex chars) used ONLY to encrypt/decrypt secrets
  // stored in system_mail_settings.smtp_password_encrypted. Generate with:
  // node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  SETTINGS_ENCRYPTION_KEY: Joi.string().hex().length(64).required(),

  // ---- Storage (avatar, file đính kèm) ----
  STORAGE_DRIVER: Joi.string().valid('local', 's3').default('local'),
  STORAGE_LOCAL_DIR: Joi.string().default('uploads'),
  STORAGE_LOCAL_PUBLIC_PATH: Joi.string().optional(),
  // Bắt buộc khi chạy driver s3: thiếu bucket thì upload không thể thành công,
  // fail-fast lúc bootstrap tốt hơn 500 lúc HR bấm lưu ảnh.
  S3_BUCKET: Joi.string().when('STORAGE_DRIVER', {
    is: 's3',
    then: Joi.required(),
    otherwise: Joi.optional().allow(''),
  }),
  S3_PUBLIC_BASE_URL: Joi.string().uri().optional().allow(''),
  AVATAR_MAX_BYTES: Joi.number()
    .integer()
    .min(1)
    .default(2 * 1024 * 1024),

  // ---- Seed (dev only) ----
  SEED_DEFAULT_PASSWORD: Joi.string().min(8).optional(),
});
