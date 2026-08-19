import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * DataSource used exclusively by the TypeORM CLI (migration:generate /
 * migration:run / migration:revert). The app runtime uses DatabaseModule
 * (TypeOrmModule.forRootAsync) instead.
 */
export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'hrm_dev',
  charset: 'utf8mb4',
  timezone: '+07:00',
  entities: [__dirname + '/../{modules,shared}/**/entities/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
