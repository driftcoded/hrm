import * as winston from 'winston';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Winston logger dùng cho toàn app (thay thế Nest logger mặc định qua
 * app.useLogger() trong main.ts). 2 transport: console (có màu, dev-friendly)
 * + file trong thư mục logs/ (đã gitignore).
 *
 * KHÔNG log password, token, CCCD (xem CLAUDE.md §Bảo mật).
 */
export const winstonLoggerOptions: winston.LoggerOptions = {
  level: isProduction ? 'info' : 'debug',
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        nestWinstonModuleUtilities.format.nestLike('HRM', {
          colors: true,
          prettyPrint: true,
        }),
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  ],
};
