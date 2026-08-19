import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ServerResponse } from 'http';
import { resolve } from 'path';
import { WinstonModule } from 'nest-winston';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { winstonLoggerOptions } from './config/winston.config';
import { validationExceptionFactory } from './common/pipes/validation-exception.factory';
import { SWAGGER_BEARER_AUTH_NAME } from './common/decorators/api-auth.decorator';
import { StorageConfig } from './config/storage.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: WinstonModule.createLogger(winstonLoggerOptions),
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api/v1');
  const frontendUrl = configService.get<string>(
    'auth.frontendUrl',
    'http://localhost:5173',
  );

  app.use(helmet());
  // Cần cho refresh token cookie (HttpOnly) – xem RefreshCookieService.
  app.use(cookieParser());

  // credentials: true để browser gửi cookie HttpOnly kèm request
  // (docs/architecture.md §12.3).
  app.enableCors({
    origin: [frontendUrl],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    // Browsers hide every response header from JS except a short safelist, and
    // `Content-Disposition` is not on it. Without this the Excel export still
    // downloads, but the filename the server chose is unreadable and the file
    // lands as something like "download". Invisible in dev, because the Vite
    // proxy makes the call same-origin.
    exposedHeaders: ['Content-Disposition'],
  });

  // Global route prefix (vd: /api/v1). KHÔNG áp dụng cho path Swagger UI
  // truyền trực tiếp vào SwaggerModule.setup (Nest global prefix chỉ ảnh
  // hưởng @Controller() routes).
  app.setGlobalPrefix(apiPrefix);

  // Driver lưu trữ `local` ghi file xuống đĩa; phải có route tĩnh thì frontend
  // mới lấy được ảnh. Với driver `s3` file nằm trên AWS nên không cần route này
  // (docs: src/shared/storage/storage.module.ts).
  const storage = configService.getOrThrow<StorageConfig>('storage');
  if (storage.driver === 'local') {
    app.useStaticAssets(resolve(process.cwd(), storage.localDir), {
      prefix: storage.localPublicPath,
      index: false,
      // File upload KHÔNG bao giờ được trình duyệt thực thi như HTML/script.
      // `res` được annotate tường minh: kiểu suy ra từ options là `any`, nên
      // không có type thì eslint chặn (no-unsafe-call / no-unsafe-member-access).
      setHeaders: (res: ServerResponse) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', 'inline');
      },
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: validationExceptionFactory,
    }),
  );

  // Swagger is NOT mounted in production. The spec is a complete map of the
  // API — every route, every DTO field, every error code — and serving it
  // publicly hands an attacker the reconnaissance step for free. It stays on
  // everywhere else, which is where it is actually used.
  //
  // If it is ever wanted on a staging box, gate it on its own env flag rather
  // than loosening this check; "production" should not be the thing standing
  // between the public and the schema.
  const isProduction =
    configService.get<string>('app.nodeEnv') === 'production';

  if (isProduction) {
    new Logger('Bootstrap').log('Swagger disabled (NODE_ENV=production)');
  } else {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('HRM Backend API')
      .setDescription('API quản lý nhân sự (HRM) cho công ty Việt Nam')
      .setVersion('0.1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        SWAGGER_BEARER_AUTH_NAME,
      )
      .addCookieAuth('refresh_token', {
        type: 'apiKey',
        in: 'cookie',
        description:
          'Refresh token (HttpOnly, SameSite=Strict, Secure ở production). Được set bởi POST /auth/login.',
      })
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port);
}

void bootstrap();
