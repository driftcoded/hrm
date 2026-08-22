import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthConfig } from '@/config/auth.config';
import { MAIL_TRANSPORT } from './mail.constants';
import { MailSendResult, MailTransport } from './mail-transport.interface';
import { renderNotificationEmail } from './templates/notification.template';
import { renderResetPasswordEmail } from './templates/reset-password.template';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    private readonly configService: ConfigService,
  ) {}

  /** Transport đang dùng – hữu ích cho health check / test. */
  get transportKind(): 'dev' | 'smtp' {
    return this.transport.kind;
  }

  /**
   * Gửi email chứa link đặt lại mật khẩu.
   * KHÔNG log rawToken / resetUrl (CLAUDE.md §Bảo mật) – chỉ log recipient + reference.
   */
  async sendResetPasswordEmail(params: {
    to: string;
    recipientName: string;
    rawToken: string;
    expiresInMinutes: number;
  }): Promise<MailSendResult> {
    const auth = this.configService.getOrThrow<AuthConfig>('auth');
    const resetUrl = `${auth.frontendUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(params.rawToken)}`;

    const rendered = renderResetPasswordEmail({
      recipientName: params.recipientName,
      resetUrl,
      expiresInMinutes: params.expiresInMinutes,
    });

    const result = await this.transport.send({
      to: params.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    this.logger.log(
      `Reset-password email queued for ${params.to} via transport=${result.transport}`,
    );

    return result;
  }

  /**
   * Gửi email thông báo do người dùng soạn.
   *
   * Đi qua `MAIL_TRANSPORT` như mọi email khác: đặt `smtp` thì gửi thật bằng
   * cấu hình admin lưu ở `/settings/mail`, để `dev` thì ghi ra file. Không gọi
   * thẳng SMTP để một môi trường dev không bất ngờ bắn mail thật cho nhân viên.
   */
  async sendNotificationEmail(params: {
    to: string;
    recipientName: string;
    subject: string;
    body: string;
  }): Promise<MailSendResult> {
    const rendered = renderNotificationEmail({
      recipientName: params.recipientName,
      subject: params.subject,
      body: params.body,
    });

    const result = await this.transport.send({
      to: params.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    this.logger.log(
      `Notification email queued for ${params.to} via transport=${result.transport}`,
    );

    return result;
  }
}
