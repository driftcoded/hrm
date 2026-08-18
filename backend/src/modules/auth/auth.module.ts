import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtConfig } from '@/config/jwt.config';
import { parseDurationToSeconds } from '@/common/utils/duration.util';
import { UsersModule } from '@/modules/users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { RefreshCookieService } from './refresh-cookie.service';
import { RefreshTokensRepository } from './refresh-tokens.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefreshToken]),
    UsersModule,
    // global: true để JwtAuthGuard (đăng ký ở AppModule qua APP_GUARD)
    // inject được JwtService mà không phải import JwtModule ở mọi nơi.
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const jwt = configService.getOrThrow<JwtConfig>('jwt');

        return {
          secret: jwt.secret,
          // Quy đổi '15m' -> 900 (giây) để khớp type của jsonwebtoken
          // và trùng với `expiresIn` trả về cho client.
          signOptions: { expiresIn: parseDurationToSeconds(jwt.expiresIn) },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, RefreshTokensRepository, RefreshCookieService],
  exports: [AuthService],
})
export class AuthModule {}
