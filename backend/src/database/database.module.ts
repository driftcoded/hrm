import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseConfig } from '../config/database.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const db = configService.getOrThrow<DatabaseConfig>('database');

        return {
          type: 'mysql' as const,
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.database,
          charset: 'utf8mb4',
          timezone: '+07:00',
          // `{modules,shared}`: most entities live under modules/, but a few
          // (e.g. system_mail_settings) belong to shared/ infra modules
          // (mail, storage) rather than any single business module.
          entities: [
            __dirname + '/../{modules,shared}/**/entities/*.entity{.ts,.js}',
          ],
          autoLoadEntities: true,
          synchronize: false,
          migrationsRun: false,
          retryAttempts: 5,
          retryDelay: 3000,
          logging:
            configService.get<string>('app.nodeEnv') === 'development'
              ? ['error', 'warn']
              : ['error'],
        };
      },
    }),
  ],
})
export class DatabaseModule {}
