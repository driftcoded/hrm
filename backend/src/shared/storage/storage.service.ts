import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { StorageConfig } from '@/config/storage.config';
import {
  assertValidAvatar,
  assertValidImage,
  UploadedFileLike,
} from './image-file.util';
import { StorageDriver, StoredFile } from './storage-driver.interface';
import { STORAGE_DRIVER } from './storage.constants';

export type SystemAssetKind = 'logo' | 'favicon';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(STORAGE_DRIVER) private readonly driver: StorageDriver,
    private readonly configService: ConfigService,
  ) {}

  /** Currently active driver — useful for health checks / tests. */
  get driverKind(): 'local' | 's3' {
    return this.driver.kind;
  }

  get avatarMaxBytes(): number {
    return this.storage.avatarMaxBytes;
  }

  /**
   * Validates (size + magic bytes) and stores an employee's avatar.
   *
   * The filename includes a random suffix so a new upload gets a new URL —
   * this busts browser/CDN caching of the old image and prevents outsiders
   * from guessing another employee's avatar path.
   */
  async putEmployeeAvatar(
    employeeId: number,
    file: UploadedFileLike | undefined,
  ): Promise<StoredFile> {
    const { kind, buffer } = assertValidAvatar(file, this.avatarMaxBytes);
    const suffix = randomBytes(8).toString('hex');

    const stored = await this.driver.put({
      key: `avatars/${employeeId}/${suffix}.${kind.extension}`,
      body: buffer,
      contentType: kind.mime,
    });

    this.logger.log(
      `Đã lưu avatar của nhân viên ${employeeId} qua driver=${stored.driver} (key=${stored.key})`,
    );

    return stored;
  }

  /**
   * Validates and stores the logo/favicon shown in the UI
   * (system_branding_settings). Shares the avatar size limit
   * (`AVATAR_MAX_BYTES`) — not an employee photo, but a similarly small UI
   * image, so a separate limit isn't needed.
   */
  async putSystemAsset(
    kind: SystemAssetKind,
    file: UploadedFileLike | undefined,
  ): Promise<StoredFile> {
    const { kind: imageKind, buffer } = assertValidImage(
      file,
      this.avatarMaxBytes,
      {
        errorCodePrefix: kind.toUpperCase(),
        label: kind === 'logo' ? 'Logo' : 'Favicon',
        multipartField: kind,
      },
    );
    const suffix = randomBytes(8).toString('hex');

    const stored = await this.driver.put({
      key: `branding/${kind}-${suffix}.${imageKind.extension}`,
      body: buffer,
      contentType: imageKind.mime,
    });

    this.logger.log(
      `Đã lưu ${kind} hệ thống qua driver=${stored.driver} (key=${stored.key})`,
    );

    return stored;
  }

  /**
   * Removes an old file by the URL stored in the DB. Never throws: a
   * cleanup failure must not break the business operation that's currently
   * running.
   */
  async removeByUrl(url: string | null): Promise<void> {
    const key = this.extractKey(url);

    if (!key) {
      return;
    }

    try {
      await this.driver.remove(key);
    } catch (error) {
      this.logger.warn(
        `Không xoá được file cũ (${key}): ${error instanceof Error ? error.message : 'lỗi không xác định'}`,
      );
    }
  }

  /**
   * Recovers the storage key from a saved URL. Only accepts URLs generated
   * by the currently active driver — external URLs (e.g. images imported
   * from a legacy system) are skipped instead of triggering a failed delete
   * attempt.
   */
  private extractKey(url: string | null): string | null {
    if (!url) {
      return null;
    }

    if (this.driver.kind === 'local') {
      const prefix = `${this.storage.localPublicPath.replace(/\/$/, '')}/`;
      return url.startsWith(prefix) ? url.slice(prefix.length) : null;
    }

    const match = /^https?:\/\/[^/]+\/(.+)$/.exec(url);
    return match ? match[1] : null;
  }

  private get storage(): StorageConfig {
    return this.configService.getOrThrow<StorageConfig>('storage');
  }
}
