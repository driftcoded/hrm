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
  MAIL_TRANSPORT: Joi.string().valid('dev', 'ses').default('dev'),
  MAIL_FROM: Joi.string().default('no-reply@company.local'),
  MAIL_FROM_NAME: Joi.string().default('HRM System'),
  MAIL_DEV_OUTPUT_DIR: Joi.string().default('logs/mail'),
  AWS_REGION: Joi.string().default('ap-southeast-1'),

  // ---- Seed (dev only) ----
  SEED_DEFAULT_PASSWORD: Joi.string().min(8).optional(),
});
