import { mkdir, rm, writeFile } from 'fs/promises';
import { dirname, join, resolve, sep } from 'path';
import {
  PutObjectParams,
  StorageDriver,
  StoredFile,
} from '../storage-driver.interface';

/**
 * Driver dev: ghi file xuống đĩa thay vì S3 (giống cách MailModule dùng
 * DevFileMailTransport khi chưa có AWS credentials).
 *
 * URL trả về là đường dẫn tương đối (`/uploads/avatars/…`) để frontend gọi
 * được qua Vite proxy / Nginx mà không cần biết host của backend.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly kind = 'local' as const;

  private readonly rootDir: string;

  constructor(
    rootDir: string,
    private readonly publicPath: string,
  ) {
    this.rootDir = resolve(process.cwd(), rootDir);
  }

  async put(params: PutObjectParams): Promise<StoredFile> {
    const filePath = this.resolveKey(params.key);

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, params.body);

    return {
      key: params.key,
      url: `${this.publicPath.replace(/\/$/, '')}/${params.key}`,
      driver: this.kind,
    };
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  /**
   * Chặn path traversal: key do service dựng nên nhưng vẫn kiểm tra lại —
   * `../../.env` không bao giờ được thoát khỏi thư mục gốc.
   */
  private resolveKey(key: string): string {
    const filePath = resolve(join(this.rootDir, key));

    if (filePath !== this.rootDir && !filePath.startsWith(this.rootDir + sep)) {
      throw new Error(`Storage key "${key}" escapes the storage root`);
    }

    return filePath;
  }
}
