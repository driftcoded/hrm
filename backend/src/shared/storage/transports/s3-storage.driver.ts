import { Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  PutObjectParams,
  StorageDriver,
  StoredFile,
} from '../storage-driver.interface';

/**
 * Driver AWS S3 – code path cho production.
 *
 * ⚠️ TRẠNG THÁI: CHƯA ĐƯỢC KÍCH HOẠT / CHƯA TỪNG CHẠY THẬT — giống hệt
 * `SesMailTransport`. Dự án chưa có AWS credentials nên `@aws-sdk/client-s3`
 * CHƯA được cài vào package.json; SDK được nạp bằng dynamic import với
 * specifier không phải literal để TypeScript không đòi package lúc build.
 * Mặc định `STORAGE_DRIVER=local` → toàn bộ upload ở dev/test ghi xuống đĩa.
 *
 * Khi lên production:
 *  1. `npm install @aws-sdk/client-s3`
 *  2. Cấp credentials (IAM role của EC2/ECS là tốt nhất)
 *  3. Đặt `STORAGE_DRIVER=s3`, `S3_BUCKET`, `AWS_REGION`
 *  4. PLAN §8.1: bucket phải private + truy cập qua presigned URL TTL 15 phút
 *     (hiện `url` đang dựng dạng public object URL — sẽ đổi ở Giai đoạn 8).
 */
export class S3StorageDriver implements StorageDriver {
  readonly kind = 's3' as const;

  private readonly logger = new Logger(S3StorageDriver.name);

  constructor(
    private readonly bucket: string,
    private readonly region: string,
    private readonly publicBaseUrl: string,
  ) {
    if (!bucket) {
      throw new Error('STORAGE_DRIVER=s3 yêu cầu biến môi trường S3_BUCKET');
    }
  }

  async put(params: PutObjectParams): Promise<StoredFile> {
    const sdk = await this.loadSdk();
    const client = new sdk.S3Client({ region: this.region });

    await client.send(
      new sdk.PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
      }),
    );

    return {
      key: params.key,
      url: this.buildUrl(params.key),
      driver: this.kind,
    };
  }

  async remove(key: string): Promise<void> {
    try {
      const sdk = await this.loadSdk();
      const client = new sdk.S3Client({ region: this.region });

      await client.send(
        new sdk.DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      // Xoá ảnh cũ chỉ là dọn rác: hỏng ở bước này KHÔNG được làm hỏng
      // request đang cập nhật avatar mới.
      this.logger.warn(
        `Không xoá được object S3 ${key}: ${error instanceof Error ? error.message : 'lỗi không xác định'}`,
      );
    }
  }

  private buildUrl(key: string): string {
    const base =
      this.publicBaseUrl.length > 0
        ? this.publicBaseUrl.replace(/\/$/, '')
        : `https://${this.bucket}.s3.${this.region}.amazonaws.com`;

    return `${base}/${key}`;
  }

  private async loadSdk(): Promise<S3SdkLike> {
    const moduleName = '@aws-sdk/client-s3';
    try {
      const imported: unknown = await import(moduleName);
      return imported as S3SdkLike;
    } catch {
      this.logger.error(
        '[storage:s3] Không nạp được @aws-sdk/client-s3. Cài package và cấu hình credentials trước khi dùng STORAGE_DRIVER=s3.',
      );
      throw new ServiceUnavailableException({
        code: 'STORAGE_DRIVER_UNAVAILABLE',
        message:
          'S3 storage driver is not installed. Run `npm install @aws-sdk/client-s3` and configure AWS credentials.',
      });
    }
  }
}

/** Chữ ký tối thiểu của @aws-sdk/client-s3 mà driver này dùng. */
interface S3SdkLike {
  S3Client: new (config: { region: string }) => {
    send(command: unknown): Promise<unknown>;
  };
  PutObjectCommand: new (input: {
    Bucket: string;
    Key: string;
    Body: Buffer;
    ContentType: string;
  }) => unknown;
  DeleteObjectCommand: new (input: { Bucket: string; Key: string }) => unknown;
}
