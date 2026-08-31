import { registerAs } from '@nestjs/config';

/**
 * `local` – ghi file vào thư mục trên đĩa và phục vụ qua `/uploads/...`
 *           (mặc định môi trường dev, không cần AWS credentials).
 * `s3`    – upload thật lên S3 (bật ở production khi đã có credentials).
 */
export type StorageDriverKind = 'local' | 's3';

export interface StorageConfig {
  driver: StorageDriverKind;
  /** Thư mục gốc khi driver = local. */
  localDir: string;
  /**
   * Prefix URL công khai của file local. Mặc định nằm DƯỚI `API_PREFIX`
   * (`/api/v1/uploads`) để frontend lấy được ảnh qua đúng Vite proxy `/api`
   * đã có sẵn, không phải thêm rule proxy thứ hai — cùng lý do đã dùng cho
   * `Path` của cookie refresh token ở Giai đoạn 1.
   */
  localPublicPath: string;
  /** Bucket S3 – chỉ dùng khi driver = s3. */
  s3Bucket: string;
  awsRegion: string;
  /**
   * Base URL để dựng URL công khai (CDN/CloudFront). Rỗng = dùng endpoint S3
   * mặc định `https://<bucket>.s3.<region>.amazonaws.com`.
   */
  s3PublicBaseUrl: string;
}

export const storageConfig = registerAs('storage', (): StorageConfig => {
  const driver = process.env.STORAGE_DRIVER === 's3' ? 's3' : 'local';
  const apiPrefix = (process.env.API_PREFIX ?? 'api/v1').replace(
    /^\/+|\/+$/g,
    '',
  );

  return {
    driver,
    localDir: process.env.STORAGE_LOCAL_DIR ?? 'uploads',
    localPublicPath:
      process.env.STORAGE_LOCAL_PUBLIC_PATH ?? `/${apiPrefix}/uploads`,
    s3Bucket: process.env.S3_BUCKET ?? '',
    awsRegion: process.env.AWS_REGION ?? 'ap-southeast-1',
    s3PublicBaseUrl: process.env.S3_PUBLIC_BASE_URL ?? '',
  };
});
