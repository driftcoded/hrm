import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemBrandingSettings } from './entities/system-branding-settings.entity';

/** Bảng chỉ có 1 dòng — id luôn = 1 (ràng buộc CHECK ở migration). */
const SETTINGS_ROW_ID = 1;

/** Chỉ TypeORM query (CLAUDE.md §Kiến trúc module). */
@Injectable()
export class BrandingSettingsRepository {
  constructor(
    @InjectRepository(SystemBrandingSettings)
    private readonly repository: Repository<SystemBrandingSettings>,
  ) {}

  async get(): Promise<SystemBrandingSettings> {
    const row = await this.repository.findOneBy({ id: SETTINGS_ROW_ID });

    if (!row) {
      // Không thể xảy ra nếu migration CreateSystemSettings đã chạy — ném lỗi
      // rõ ràng thay vì để null lan xuống service gây lỗi khó hiểu hơn.
      throw new Error(
        'system_branding_settings row (id=1) is missing — check the CreateSystemSettings migration ran',
      );
    }

    return row;
  }

  async update(patch: Partial<SystemBrandingSettings>): Promise<void> {
    await this.repository.update({ id: SETTINGS_ROW_ID }, patch);
  }
}
