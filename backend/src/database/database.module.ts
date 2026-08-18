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
          entities: [__dirname + '/../modules/**/entities/*.entity{.ts,.js}'],
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
