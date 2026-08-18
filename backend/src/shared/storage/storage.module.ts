import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageConfig } from '@/config/storage.config';
import { StorageDriver } from './storage-driver.interface';
import { STORAGE_DRIVER } from './storage.constants';
import { StorageService } from './storage.service';
import { LocalStorageDriver } from './transports/local-storage.driver';
import { S3StorageDriver } from './transports/s3-storage.driver';

/**
 * Chọn driver lưu trữ theo `STORAGE_DRIVER` (cùng khuôn với MailModule):
 *  - `local` (mặc định): ghi file xuống `uploads/` → upload avatar chạy được
 *    ở local mà không cần AWS credentials.
 *  - `s3`: upload thật lên S3 (chỉ khi đã có credentials + đã cài SDK).
 *
 * Ở production mà vẫn để `local` thì log cảnh báo rõ ràng: file nằm trên đĩa
 * của MỘT instance nên PM2 cluster nhiều máy sẽ đọc không thấy ảnh.
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
