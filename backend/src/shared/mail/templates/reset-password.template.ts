export interface ResetPasswordTemplateData {
  /** Tên hiển thị người nhận (fullName của nhân viên hoặc username). */
  recipientName: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export interface RenderedMailTemplate {
  subject: string;
  html: string;
  text: string;
}

/**
 * Template email "Đặt lại mật khẩu" (docs/architecture.md §11.1).
 *
 * Kiến trúc gốc đề xuất Handlebars (.hbs); ở đây dùng hàm TypeScript trả về
 * HTML + text để không thêm dependency và để template được type-check.
 * Khi số lượng email nhiều lên có thể chuyển sang .hbs mà không đổi MailService.
 */
export function renderResetPasswordEmail(
  data: ResetPasswordTemplateData,
): RenderedMailTemplate {
  const subject = 'Đặt lại mật khẩu – HRM';

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.6">
  <p>Xin chào <strong>${escapeHtml(data.recipientName)}</strong>,</p>
  <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản HRM của bạn.</p>
  <p>
    <a href="${escapeHtml(data.resetUrl)}"
       style="display:inline-block;padding:10px 18px;background:#1677ff;color:#fff;text-decoration:none;border-radius:4px">
      Đặt lại mật khẩu
    </a>
  </p>
  <p>Hoặc mở liên kết sau trong trình duyệt:<br>
    <a href="${escapeHtml(data.resetUrl)}">${escapeHtml(data.resetUrl)}</a>
  </p>
  <p>Liên kết có hiệu lực trong <strong>${data.expiresInMinutes} phút</strong> và chỉ dùng được một lần.</p>
  <p>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này – mật khẩu hiện tại của bạn vẫn an toàn.</p>
  <p style="color:#888">HRM System</p>
</div>`.trim();

  const text = [
    `Xin chào ${data.recipientName},`,
    '',
    'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản HRM của bạn.',
    'Mở liên kết sau để đặt mật khẩu mới:',
    data.resetUrl,
    '',
    `Liên kết có hiệu lực trong ${data.expiresInMinutes} phút và chỉ dùng được một lần.`,
    'Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.',
    '',
    'HRM System',
  ].join('\n');

  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
