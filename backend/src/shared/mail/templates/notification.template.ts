import { RenderedMailTemplate } from './reset-password.template';

export interface NotificationTemplateData {
  /** Tên hiển thị người nhận. */
  recipientName: string;
  subject: string;
  /** Nội dung người gửi gõ vào, dạng văn bản thuần. */
  body: string;
}

/**
 * Template email thông báo do nhân sự tự soạn (`POST /employees/email`).
 *
 * Nội dung là văn bản THUẦN, không phải HTML: người gửi gõ trong một ô textarea,
 * và nhận HTML từ trình duyệt rồi phát thẳng vào hộp thư người khác là mở đường
 * cho việc chèn thẻ tuỳ ý. Hàm này escape toàn bộ rồi mới dựng đoạn văn.
 */
export function renderNotificationEmail(
  data: NotificationTemplateData,
): RenderedMailTemplate {
  const paragraphs = toParagraphs(data.body);

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.6">
  <p>Xin chào <strong>${escapeHtml(data.recipientName)}</strong>,</p>
${paragraphs.map((line) => `  <p>${escapeHtml(line).replace(/\n/g, '<br />')}</p>`).join('\n')}
  <p style="color:#888;font-size:12px;margin-top:24px">
    Email này được gửi từ hệ thống HRM. Vui lòng không trả lời trực tiếp.
  </p>
</div>`.trim();

  const text = [`Xin chào ${data.recipientName},`, '', data.body].join('\n');

  return { subject: data.subject, html, text };
}

/** Tách theo dòng trống — mỗi khối thành một đoạn, xuống dòng đơn giữ nguyên. */
function toParagraphs(body: string): string[] {
  return body
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
