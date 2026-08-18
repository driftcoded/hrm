import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
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
      setHeaders: (res) => {
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

  await app.listen(port);
}

void bootstrap();
