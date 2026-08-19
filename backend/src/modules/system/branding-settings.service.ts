import { Injectable } from '@nestjs/common';
import { toIsoString } from '@/common/utils/date.util';
import { UploadedFileLike } from '@/shared/storage/image-file.util';
import { StorageService } from '@/shared/storage/storage.service';
import { BrandingSettingsRepository } from './branding-settings.repository';
import { BrandingSettingsResponseDto } from './dto/branding-settings-response.dto';
import { UpdateBrandingSettingsDto } from './dto/update-branding-settings.dto';
import { SystemBrandingSettings } from './entities/system-branding-settings.entity';

/**
 * Toàn bộ business logic của cấu hình thương hiệu (CLAUDE.md §Kiến trúc module).
 * `get()` KHÔNG yêu cầu đăng nhập ở tầng controller — trang /login cần đọc
 * được tên công ty/logo trước khi có access token.
 */
@Injectable()
export class BrandingSettingsService {
  constructor(
    private readonly repository: BrandingSettingsRepository,
    private readonly storageService: StorageService,
  ) {}

  async get(): Promise<BrandingSettingsResponseDto> {
    return this.toResponse(await this.repository.get());
  }

  async updateCompanyName(
    dto: UpdateBrandingSettingsDto,
    userId: number,
  ): Promise<BrandingSettingsResponseDto> {
    await this.repository.update({
      companyName: dto.companyName.trim(),
      updatedBy: userId,
    });

    return this.get();
  }

  async uploadLogo(
    file: UploadedFileLike | undefined,
    userId: number,
  ): Promise<BrandingSettingsResponseDto> {
    const current = await this.repository.get();
    const stored = await this.storageService.putSystemAsset('logo', file);

    await this.repository.update({ logoUrl: stored.url, updatedBy: userId });
    await this.storageService.removeByUrl(current.logoUrl);

    return this.get();
  }

  async removeLogo(userId: number): Promise<BrandingSettingsResponseDto> {
    const current = await this.repository.get();

    await this.repository.update({ logoUrl: null, updatedBy: userId });
    await this.storageService.removeByUrl(current.logoUrl);

    return this.get();
  }

  async uploadFavicon(
    file: UploadedFileLike | undefined,
    userId: number,
  ): Promise<BrandingSettingsResponseDto> {
    const current = await this.repository.get();
    const stored = await this.storageService.putSystemAsset('favicon', file);

    await this.repository.update({
      faviconUrl: stored.url,
      updatedBy: userId,
    });
    await this.storageService.removeByUrl(current.faviconUrl);

    return this.get();
  }

  async removeFavicon(userId: number): Promise<BrandingSettingsResponseDto> {
    const current = await this.repository.get();

    await this.repository.update({ faviconUrl: null, updatedBy: userId });
    await this.storageService.removeByUrl(current.faviconUrl);

    return this.get();
  }

  private toResponse(row: SystemBrandingSettings): BrandingSettingsResponseDto {
    return {
      companyName: row.companyName,
      logoUrl: row.logoUrl ?? null,
      faviconUrl: row.faviconUrl ?? null,
      updatedAt: toIsoString(row.updatedAt),
    };
  }
}
