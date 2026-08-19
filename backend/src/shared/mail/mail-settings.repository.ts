import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemMailSettings } from './entities/system-mail-settings.entity';

/** Bảng chỉ có 1 dòng — id luôn = 1 (ràng buộc CHECK ở migration). */
const SETTINGS_ROW_ID = 1;

/** Chỉ TypeORM query (CLAUDE.md §Kiến trúc module). */
@Injectable()
export class MailSettingsRepository {
  constructor(
    @InjectRepository(SystemMailSettings)
    private readonly repository: Repository<SystemMailSettings>,
  ) {}

  async get(): Promise<SystemMailSettings> {
    const row = await this.repository.findOneBy({ id: SETTINGS_ROW_ID });

    if (!row) {
      throw new Error(
        'system_mail_settings row (id=1) is missing — check the CreateSystemSettings migration ran',
      );
    }

    return row;
  }

  async update(patch: Partial<SystemMailSettings>): Promise<void> {
    await this.repository.update({ id: SETTINGS_ROW_ID }, patch);
  }
}
