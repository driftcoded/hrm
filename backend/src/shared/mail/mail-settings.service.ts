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
 * Toàn bộ business logic của cấu hình SMTP (CLAUDE.md §Kiến trúc module).
 * CHỈ admin gọi được (chặn ở controller) — service này giữ nguyên tắc "không
 * bao giờ trả mật khẩu thật ra khỏi tầng này", kể cả cho chính admin.
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

    // Bỏ trống smtpPassword = giữ nguyên; chỉ ghi đè khi client gửi giá trị mới.
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
   * Gửi thử bằng cấu hình ĐANG LƯU trong DB — KHÔNG đi qua `MAIL_TRANSPORT`
   * env, vì mục đích của nút này là kiểm chứng SMTP thật hoạt động dù app
   * đang chạy `MAIL_TRANSPORT=dev` ở môi trường local.
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
      // KHÔNG để lỗi SMTP thật (sai mật khẩu, sai port, bị chặn...) rơi vào
      // catch-all của HttpExceptionFilter: ở production message sẽ bị thay
      // bằng "Internal server error" chung chung, làm mất hết tác dụng của
      // nút "gửi thử" (admin cần biết CHÍNH XÁC vì sao SMTP không kết nối
      // được). Nội dung lỗi ở đây an toàn để lộ: đây là hành động chủ động
      // của chính admin, không phải request thường của user khác.
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
