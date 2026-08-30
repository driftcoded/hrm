import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageConfig } from '@/config/storage.config';
import { StorageDriver } from './storage-driver.interface';
import { STORAGE_DRIVER } from './storage.constants';
import { StorageService } from './storage.service';
import { LocalStorageDriver } from './transports/local-storage.driver';
import { S3StorageDriver } from './transports/s3-storage.driver';

/**
 * Selects the storage driver via `STORAGE_DRIVER` (same pattern as
 * MailModule):
 *  - `local` (default): writes files to `uploads/` so avatar upload works
 *    locally without AWS credentials.
 *  - `s3`: uploads to a real S3 bucket (requires credentials + the SDK
 *    installed).
 *
 * Logs a clear warning if `local` is still set in production: files would
 * live on a single instance's disk, so other machines in a PM2 cluster
 * wouldn't be able to read them.
 */
@Global()
@Module({
  providers: [
    {
      provide: STORAGE_DRIVER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): StorageDriver => {
        const storage = configService.getOrThrow<StorageConfig>('storage');
        const nodeEnv = configService.get<string>('app.nodeEnv');
        const logger = new Logger('StorageModule');

        if (storage.driver === 's3') {
          logger.log(`Storage driver: AWS S3 (bucket=${storage.s3Bucket})`);
          return new S3StorageDriver(
            storage.s3Bucket,
            storage.awsRegion,
            storage.s3PublicBaseUrl,
          );
        }

        if (nodeEnv === 'production') {
          logger.warn(
            'STORAGE_DRIVER=local ở môi trường production: file chỉ nằm trên đĩa của một instance. Đặt STORAGE_DRIVER=s3.',
          );
        }

        logger.log(`Storage driver: local -> ${storage.localDir}`);
        return new LocalStorageDriver(
          storage.localDir,
          storage.localPublicPath,
        );
      },
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
