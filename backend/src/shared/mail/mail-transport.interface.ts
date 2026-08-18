export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailSendResult {
  transport: 'dev' | 'ses';
  /** Đường dẫn file HTML (transport dev) hoặc messageId của SES. */
  reference: string;
}

/**
 * Transport gửi mail. Có 2 driver:
 *  - `DevFileMailTransport`: ghi ra file HTML trong logs/mail (dev/test)
 *  - `SesMailTransport`: gửi thật qua AWS SES (production, cần credentials)
 */
export interface MailTransport {
  readonly kind: 'dev' | 'ses';
  send(message: MailMessage): Promise<MailSendResult>;
}
