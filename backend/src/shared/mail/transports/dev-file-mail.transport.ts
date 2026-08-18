import { Logger } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import {
  MailMessage,
  MailSendResult,
  MailTransport,
} from '../mail-transport.interface';

/**
 * Transport DEV: không gửi email thật, render ra file HTML để đọc/kiểm tra bằng
 * mắt hoặc bằng test tự động: `logs/mail/<timestamp>-<to>.html`.
 *
 * ⚠️ CHỈ dùng cho dev/test. File này chứa nội dung email đầy đủ (bao gồm link
 * reset password), nên `logs/` phải luôn nằm trong .gitignore và transport này
 * KHÔNG được bật ở production (xem MailModule: production yêu cầu MAIL_TRANSPORT=ses).
 * Log line chỉ ghi đường dẫn file + người nhận, KHÔNG ghi token (CLAUDE.md §Bảo mật).
 */
export class DevFileMailTransport implements MailTransport {
  readonly kind = 'dev' as const;

  private readonly logger = new Logger(DevFileMailTransport.name);

  constructor(private readonly outputDir: string) {}

  async send(message: MailMessage): Promise<MailSendResult> {
    const dir = resolve(process.cwd(), this.outputDir);
    await mkdir(dir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeRecipient = message.to.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = join(dir, `${timestamp}-${safeRecipient}.html`);

    const document = [
      '<!doctype html>',
      '<html lang="vi"><head><meta charset="utf-8">',
      `<title>${escapeHtml(message.subject)}</title></head><body>`,
      '<pre style="font-family:monospace;background:#f5f5f5;padding:12px">',
      `To: ${escapeHtml(message.to)}\nSubject: ${escapeHtml(message.subject)}\nDate: ${new Date().toISOString()}`,
      '</pre>',
      message.html,
      '<hr><h3>Plain text version</h3>',
      `<pre>${escapeHtml(message.text)}</pre>`,
      '</body></html>',
    ].join('\n');

    await writeFile(filePath, document, 'utf8');

    this.logger.log(
      `[mail:dev] Đã ghi email "${message.subject}" cho ${message.to} -> ${filePath}`,
    );

    return { transport: this.kind, reference: filePath };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
