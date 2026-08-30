import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemMailSettings } from './entities/system-mail-settings.entity';

/** The table only ever has 1 row — id is always = 1 (enforced by a CHECK constraint in the migration). */
const SETTINGS_ROW_ID = 1;

/** TypeORM queries only (CLAUDE.md §Module architecture). */
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
