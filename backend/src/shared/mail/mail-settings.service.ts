import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsConfig } from '@/config/settings.config';
import { encryptSecret } from '@/common/utils/encryption.util';
import { toIsoString } from '@/common/utils/date.util';
import { MailSettingsResponseDto } from './dto/mail-settings-response.dto';
import { TestMailResponseDto } from './dto/test-mail-response.dto';
import { UpdateMailSettingsDto } from './dto/update-mail-settings.dto';
import { SystemMailSettings } from './entities/system-mail-settings.entity';
import { MailSettingsRepository } from './mail-settings.repository';
import { resolveSmtpConfig } from './mail-settings.util';
import { sendSmtpMessage } from './transports/smtp-mail.transport';

/**
 * All business logic for SMTP configuration lives here (CLAUDE.md §Module
 * architecture). Only an admin can call this (enforced at the controller) —
 * this service upholds the rule "never let the real password leave this
 * layer", even back to the admin themselves.
 */
@Injectable()
export class MailSettingsService {
  constructor(
    private readonly repository: MailSettingsRepository,
    private readonly configService: ConfigService,
  ) {}

  async getForAdmin(): Promise<MailSettingsResponseDto> {
    return this.toResponse(await this.repository.get());
  }

  async update(
    dto: UpdateMailSettingsDto,
    userId: number,
  ): Promise<MailSettingsResponseDto> {
    const patch: Partial<SystemMailSettings> = {
      smtpHost: dto.smtpHost.trim(),
      smtpPort: dto.smtpPort,
      smtpSecure: dto.smtpSecure,
      smtpUsername: dto.smtpUsername?.trim() || null,
      smtpFromEmail: dto.smtpFromEmail.trim(),
      smtpFromName: dto.smtpFromName?.trim() || null,
      updatedBy: userId,
    };

    // Blank smtpPassword = keep the existing one; only overwrite when the client sends a new value.
    if (dto.smtpPassword) {
      patch.smtpPasswordEncrypted = encryptSecret(
        dto.smtpPassword,
        this.encryptionKey,
      );
    }

    await this.repository.update(patch);

    return this.getForAdmin();
  }

  /**
   * Sends a test email using the configuration CURRENTLY STORED in the DB —
   * does NOT go through the `MAIL_TRANSPORT` env var, because the whole
   * point of this button is to verify real SMTP works even while the app is
   * running with `MAIL_TRANSPORT=dev` locally.
   */
  async sendTest(to: string): Promise<TestMailResponseDto> {
    const config = await resolveSmtpConfig(this.repository, this.encryptionKey);

    if (!config) {
      throw new UnprocessableEntityException({
        code: 'MAIL_SETTINGS_INCOMPLETE',
        message:
          'Configure smtpHost, smtpPort and smtpFromEmail before sending a test email',
      });
    }

    try {
      const info = await sendSmtpMessage(config, {
        to,
        subject: 'HRM – email thử nghiệm cấu hình SMTP',
        html: '<p>Đây là email thử nghiệm từ trang cấu hình SMTP của hệ thống HRM. Nếu bạn nhận được email này, cấu hình đã hoạt động.</p>',
        text: 'Đây là email thử nghiệm từ trang cấu hình SMTP của hệ thống HRM. Nếu bạn nhận được email này, cấu hình đã hoạt động.',
      });

      return { sent: true, reference: info.messageId ?? 'unknown' };
    } catch (error) {
      // Do NOT let the real SMTP error (wrong password, wrong port, blocked...)
      // fall through to HttpExceptionFilter's catch-all: in production the
      // message would be replaced with a generic "Internal server error",
      // defeating the whole purpose of the "send test" button (the admin
      // needs to know EXACTLY why SMTP failed to connect). Exposing the raw
      // error here is safe: this is the admin's own deliberate action, not
      // an ordinary request from another user.
      throw new UnprocessableEntityException({
        code: 'MAIL_TEST_FAILED',
        message:
          error instanceof Error ? error.message : 'Failed to send test email',
      });
    }
  }

  private get encryptionKey(): string {
    return this.configService.getOrThrow<SettingsConfig>('settings')
      .encryptionKey;
  }

  private toResponse(row: SystemMailSettings): MailSettingsResponseDto {
    return {
      smtpHost: row.smtpHost,
      smtpPort: row.smtpPort,
      smtpSecure: Boolean(row.smtpSecure),
      smtpUsername: row.smtpUsername,
      hasPassword: Boolean(row.smtpPasswordEncrypted),
      smtpFromEmail: row.smtpFromEmail,
      smtpFromName: row.smtpFromName,
      updatedAt: toIsoString(row.updatedAt),
    };
  }
}
