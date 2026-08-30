import { Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  PutObjectParams,
  StorageDriver,
  StoredFile,
} from '../storage-driver.interface';

/**
 * AWS S3 driver – the production code path.
 *
 * ⚠️ STATUS: NOT ACTIVATED / NEVER RUN AGAINST REAL AWS — same situation as
 * `SesMailTransport`. The project has no AWS credentials yet, so
 * `@aws-sdk/client-s3` is NOT installed in package.json; the SDK is loaded
 * via a dynamic import with a non-literal specifier so TypeScript doesn't
 * require the package at build time. `STORAGE_DRIVER=local` is the default,
 * so all dev/test uploads are written to disk.
 *
 * To go to production:
 *  1. `npm install @aws-sdk/client-s3`
 *  2. Provision credentials (an EC2/ECS IAM role is preferred)
 *  3. Set `STORAGE_DRIVER=s3`, `S3_BUCKET`, `AWS_REGION`
 *  4. PLAN §8.1: the bucket must be private, accessed via a presigned URL
 *     with a 15-minute TTL (currently `url` is built as a public object URL
 *     — to be changed in Phase 8).
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
      // Deleting the old image is just cleanup: a failure here must NOT fail
      // the request that is updating the new avatar.
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

/** Minimal type signature of @aws-sdk/client-s3 that this driver relies on. */
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
