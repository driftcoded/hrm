import { Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  MailMessage,
  MailSendResult,
  MailTransport,
} from '../mail-transport.interface';

/**
 * Transport AWS SES – code path cho production.
 *
 * ⚠️ TRẠNG THÁI: CHƯA ĐƯỢC KÍCH HOẠT / CHƯA TỪNG CHẠY THẬT.
 * Dự án hiện KHÔNG có AWS credentials (quyết định của chủ dự án) nên:
 *  - `@aws-sdk/client-sesv2` CHƯA được cài vào package.json (tránh dependency
 *    nặng chưa dùng tới) → import bằng dynamic import, chỉ nạp khi thực sự gửi.
 *  - Chỉ chọn transport này khi `MAIL_TRANSPORT=ses`; mặc định là `dev`.
 *
 * Khi lên production, việc cần làm:
 *  1. `npm install @aws-sdk/client-sesv2`
 *  2. Cấp credentials cho môi trường chạy (IAM role của EC2/ECS là tốt nhất,
 *     hoặc AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY qua secret manager –
 *     TUYỆT ĐỐI không commit vào repo).
 *  3. Đặt `MAIL_TRANSPORT=ses`, `MAIL_FROM` (địa chỉ đã verify trong SES).
 */
export class SesMailTransport implements MailTransport {
  readonly kind = 'ses' as const;

  private readonly logger = new Logger(SesMailTransport.name);

  constructor(
    private readonly region: string,
    private readonly from: string,
    private readonly fromName: string,
  ) {}

  async send(message: MailMessage): Promise<MailSendResult> {
    const sdk = await this.loadSdk();

    const client = new sdk.SESv2Client({ region: this.region });
    const command = new sdk.SendEmailCommand({
      FromEmailAddress: `${this.fromName} <${this.from}>`,
      Destination: { ToAddresses: [message.to] },
      Content: {
        Simple: {
          Subject: { Data: message.subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: message.html, Charset: 'UTF-8' },
            Text: { Data: message.text, Charset: 'UTF-8' },
          },
        },
      },
    });

    const response = await client.send(command);
    const messageId = response.MessageId ?? 'unknown';

    this.logger.log(
      `[mail:ses] Đã gửi email "${message.subject}" cho ${message.to} (messageId=${messageId})`,
    );

    return { transport: this.kind, reference: messageId };
  }

  /**
   * Nạp SDK bằng dynamic import với specifier không phải literal để TypeScript
   * không đòi package lúc build (package chưa được cài – xem ghi chú ở trên).
   */
  private async loadSdk(): Promise<SesSdkLike> {
    const moduleName = '@aws-sdk/client-sesv2';
    try {
      const imported: unknown = await import(moduleName);
      return imported as SesSdkLike;
    } catch {
      this.logger.error(
        '[mail:ses] Không nạp được @aws-sdk/client-sesv2. Cài package và cấu hình credentials trước khi dùng MAIL_TRANSPORT=ses.',
      );
      throw new ServiceUnavailableException({
        code: 'MAIL_TRANSPORT_UNAVAILABLE',
        message:
          'SES transport is not installed. Run `npm install @aws-sdk/client-sesv2` and configure AWS credentials.',
      });
    }
  }
}

/** Chữ ký tối thiểu của @aws-sdk/client-sesv2 mà transport này dùng. */
interface SesSdkLike {
  SESv2Client: new (config: { region: string }) => {
    send(command: unknown): Promise<{ MessageId?: string }>;
  };
  SendEmailCommand: new (input: SesSendEmailInput) => unknown;
}

interface SesSendEmailInput {
  FromEmailAddress: string;
  Destination: { ToAddresses: string[] };
  Content: {
    Simple: {
      Subject: { Data: string; Charset: string };
      Body: {
        Html: { Data: string; Charset: string };
        Text: { Data: string; Charset: string };
      };
    };
  };
}
