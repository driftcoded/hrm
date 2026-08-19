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

  /** Driver đang dùng – hữu ích cho health check / test. */
  get driverKind(): 'local' | 's3' {
    return this.driver.kind;
  }

  get avatarMaxBytes(): number {
    return this.storage.avatarMaxBytes;
  }

  /**
   * Validate (dung lượng + magic bytes) rồi lưu avatar của một nhân viên.
   *
   * Tên file có phần ngẫu nhiên: URL mới khác URL cũ nên trình duyệt/CDN không
   * trả ảnh cũ từ cache, và người ngoài không đoán được đường dẫn ảnh của
   * nhân viên khác.
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
   * Validate rồi lưu logo/favicon hiển thị trên UI (system_branding_settings).
   * Dùng chung trần dung lượng với avatar (`AVATAR_MAX_BYTES`) — không phải
   * ảnh nhân viên nhưng cùng là ảnh nhỏ hiển thị trên UI nên không cần cấu
   * hình riêng.
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
   * Xoá file cũ theo URL đã lưu trong DB. KHÔNG ném lỗi: dọn rác thất bại
   * không được làm hỏng thao tác nghiệp vụ đang chạy.
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
   * Lấy lại key từ URL đã lưu. Chỉ nhận URL do CHÍNH driver hiện tại sinh ra —
   * URL trỏ ra ngoài (ảnh import từ hệ thống cũ) được bỏ qua thay vì cố xoá.
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
