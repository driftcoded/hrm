import { mkdir, rm, writeFile } from 'fs/promises';
import { dirname, join, resolve, sep } from 'path';
import {
  PutObjectParams,
  StorageDriver,
  StoredFile,
} from '../storage-driver.interface';

/**
 * Dev-mode driver: writes files to local disk instead of S3 (mirrors how
 * MailModule falls back to DevFileMailTransport when no AWS credentials are
 * configured).
 *
 * Returns a relative URL (`/uploads/avatars/…`) so the frontend can reach it
 * through the Vite proxy / Nginx without needing to know the backend's host.
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
   * Blocks path traversal: the key is built by the service layer, but is
   * still re-validated here — `../../.env` must never be able to escape the
   * storage root.
   */
  private resolveKey(key: string): string {
    const filePath = resolve(join(this.rootDir, key));

    if (filePath !== this.rootDir && !filePath.startsWith(this.rootDir + sep)) {
      throw new Error(`Storage key "${key}" escapes the storage root`);
    }

    return filePath;
  }
}
