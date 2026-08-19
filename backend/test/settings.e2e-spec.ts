import * as request from 'supertest';
import { App } from 'supertest/types';
import {
  cleanupSeedRefreshTokens,
  createE2eApp,
  E2eContext,
  errorBody,
  SEED_USERS,
  successBody,
} from './support/e2e-app';
import { loginAs } from './support/master-data-fixtures';
import { makeJpegBuffer } from './support/employee-fixtures';

interface BrandingBody {
  companyName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  updatedAt: string;
}

interface MailSettingsBody {
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUsername: string | null;
  hasPassword: boolean;
  smtpFromEmail: string | null;
  smtpFromName: string | null;
  updatedAt: string;
}

interface BrandingRow {
  company_name: string;
  logo_url: string | null;
  favicon_url: string | null;
}

interface MailSettingsRow {
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_secure: number;
  smtp_username: string | null;
  smtp_password_encrypted: string | null;
  smtp_from_email: string | null;
  smtp_from_name: string | null;
}

/**
 * Giai đoạn ngoài PLAN — cấu hình thương hiệu (public) + SMTP (chỉ admin).
 *
 * Khác với các module master data khác: `system_branding_settings` và
 * `system_mail_settings` CHỈ CÓ 1 DÒNG DUY NHẤT (không phải fixture có thể
 * tạo/xoá riêng cho từng test), nên suite này chụp lại giá trị gốc ở
 * `beforeAll` và phục hồi đúng giá trị đó ở `afterAll` thay vì dọn theo
 * prefix như các suite fixture khác.
 */
describe('Settings – branding & mail (e2e)', () => {
  let context: E2eContext;
  let server: App;

  let adminToken: string;
  let hrManagerToken: string;
  let employeeToken: string;

  let originalBranding: BrandingRow;
  let originalMailSettings: MailSettingsRow;

  beforeAll(async () => {
    context = await createE2eApp();
    server = context.app.getHttpServer() as App;

    const [branding] = await context.dataSource.query<BrandingRow[]>(
      'SELECT company_name, logo_url, favicon_url FROM system_branding_settings WHERE id = 1',
    );
    originalBranding = branding;

    const [mail] = await context.dataSource.query<MailSettingsRow[]>(
      'SELECT smtp_host, smtp_port, smtp_secure, smtp_username, smtp_password_encrypted, smtp_from_email, smtp_from_name FROM system_mail_settings WHERE id = 1',
    );
    originalMailSettings = mail;

    adminToken = await loginAs(server, SEED_USERS.admin);
    hrManagerToken = await loginAs(server, SEED_USERS.hrManager);
    employeeToken = await loginAs(server, SEED_USERS.employeeA);
  });

  afterAll(async () => {
    await context.dataSource.query(
      'UPDATE system_branding_settings SET company_name = ?, logo_url = ?, favicon_url = ?, updated_by = NULL WHERE id = 1',
      [
        originalBranding.company_name,
        originalBranding.logo_url,
        originalBranding.favicon_url,
      ],
    );
    await context.dataSource.query(
      'UPDATE system_mail_settings SET smtp_host = ?, smtp_port = ?, smtp_secure = ?, smtp_username = ?, smtp_password_encrypted = ?, smtp_from_email = ?, smtp_from_name = ?, updated_by = NULL WHERE id = 1',
      [
        originalMailSettings.smtp_host,
        originalMailSettings.smtp_port,
        originalMailSettings.smtp_secure,
        originalMailSettings.smtp_username,
        originalMailSettings.smtp_password_encrypted,
        originalMailSettings.smtp_from_email,
        originalMailSettings.smtp_from_name,
      ],
    );

    await cleanupSeedRefreshTokens(context.dataSource);
    await context.cache.reset();
    await context.app.close();
  });

  const get = (path: string, token?: string) => {
    const req = request(server).get(`/api/v1${path}`);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  const patch = (path: string, token: string) =>
    request(server)
      .patch(`/api/v1${path}`)
      .set('Authorization', `Bearer ${token}`);

  const post = (path: string, token: string) =>
    request(server)
      .post(`/api/v1${path}`)
      .set('Authorization', `Bearer ${token}`);

  const del = (path: string, token: string) =>
    request(server)
      .delete(`/api/v1${path}`)
      .set('Authorization', `Bearer ${token}`);

  // -------------------------------------------------------------- BRANDING ---

  describe('/settings/branding', () => {
    it('GET không cần token (trang /login cần đọc được trước khi đăng nhập)', async () => {
      const response = await request(server)
        .get('/api/v1/settings/branding')
        .expect(200);

      const data = successBody<BrandingBody>(response).data;
      expect(typeof data.companyName).toBe('string');
      expect(data).toHaveProperty('logoUrl');
      expect(data).toHaveProperty('faviconUrl');
    });

    it('PATCH bằng hr_manager (write role của master data khác) → 403: branding CHỈ admin', async () => {
      await patch('/settings/branding', hrManagerToken)
        .send({ companyName: 'Should Not Work' })
        .expect(403);
    });

    it('PATCH bằng admin → 200, GET công khai phản ánh ngay giá trị mới', async () => {
      const updated = successBody<BrandingBody>(
        await patch('/settings/branding', adminToken)
          .send({ companyName: 'E2E Test Company' })
          .expect(200),
      ).data;
      expect(updated.companyName).toBe('E2E Test Company');

      const publicRead = successBody<BrandingBody>(
        await request(server).get('/api/v1/settings/branding').expect(200),
      ).data;
      expect(publicRead.companyName).toBe('E2E Test Company');
    });

    it('PATCH companyName: null → 400 VALIDATION_ERROR, không update', async () => {
      const response = await patch('/settings/branding', adminToken)
        .send({ companyName: null })
        .expect(400);

      expect(errorBody(response).error.code).toBe('VALIDATION_ERROR');
    });

    it('POST logo hợp lệ (JPEG) → 201, logoUrl được lưu; xoá logo cũ khi upload logo mới', async () => {
      const first = successBody<BrandingBody>(
        await post('/settings/branding/logo', adminToken)
          .attach('logo', makeJpegBuffer(), { filename: 'logo.jpg' })
          .expect(201),
      ).data;
      expect(first.logoUrl).toContain('/uploads/branding/');

      const second = successBody<BrandingBody>(
        await post('/settings/branding/logo', adminToken)
          .attach('logo', makeJpegBuffer(128), { filename: 'logo2.jpg' })
          .expect(201),
      ).data;
      expect(second.logoUrl).not.toBe(first.logoUrl);
    });

    it('POST logo không phải ảnh thật (chỉ đổi tên .jpg) → 400 LOGO_INVALID_TYPE', async () => {
      const response = await post('/settings/branding/logo', adminToken)
        .attach('logo', Buffer.alloc(64, 0x41), { filename: 'logo.jpg' })
        .expect(400);

      expect(errorBody(response).error.code).toBe('LOGO_INVALID_TYPE');
    });

    it('POST logo bằng employee (không phải admin) → 403', async () => {
      await post('/settings/branding/logo', employeeToken)
        .attach('logo', makeJpegBuffer(), { filename: 'logo.jpg' })
        .expect(403);
    });

    it('DELETE logo → logoUrl trở về null', async () => {
      await post('/settings/branding/logo', adminToken)
        .attach('logo', makeJpegBuffer(), { filename: 'logo.jpg' })
        .expect(201);

      const result = successBody<BrandingBody>(
        await del('/settings/branding/logo', adminToken).expect(200),
      ).data;
      expect(result.logoUrl).toBeNull();
    });

    it('POST/DELETE favicon hoạt động độc lập với logo', async () => {
      const uploaded = successBody<BrandingBody>(
        await post('/settings/branding/favicon', adminToken)
          .attach('favicon', makeJpegBuffer(), { filename: 'favicon.jpg' })
          .expect(201),
      ).data;
      expect(uploaded.faviconUrl).toContain('/uploads/branding/');
      expect(uploaded.logoUrl).toBeNull();

      const removed = successBody<BrandingBody>(
        await del('/settings/branding/favicon', adminToken).expect(200),
      ).data;
      expect(removed.faviconUrl).toBeNull();
    });
  });

  // ------------------------------------------------------------------ MAIL ---

  describe('/settings/mail', () => {
    it('GET bằng hr_manager → 403: SMTP CHỈ admin (chứa mật khẩu, dù đã mã hoá)', async () => {
      await get('/settings/mail', hrManagerToken).expect(403);
    });

    it('GET không có token → 401', async () => {
      await get('/settings/mail').expect(401);
    });

    it('PATCH bằng admin → 200; GET sau đó KHÔNG BAO GIỜ trả mật khẩu thật', async () => {
      const updated = successBody<MailSettingsBody>(
        await patch('/settings/mail', adminToken)
          .send({
            smtpHost: 'smtp.e2e-test.local',
            smtpPort: 587,
            smtpSecure: false,
            smtpUsername: 'e2e-user',
            smtpPassword: 'super-secret-e2e',
            smtpFromEmail: 'no-reply@e2e-test.local',
            smtpFromName: 'E2E HRM',
          })
          .expect(200),
      ).data;

      expect(updated.hasPassword).toBe(true);
      expect(JSON.stringify(updated)).not.toContain('super-secret-e2e');

      const [row] = await context.dataSource.query<MailSettingsRow[]>(
        'SELECT smtp_password_encrypted FROM system_mail_settings WHERE id = 1',
      );
      expect(row.smtp_password_encrypted).not.toBeNull();
      expect(row.smtp_password_encrypted).not.toContain('super-secret-e2e');

      const read = successBody<MailSettingsBody>(
        await get('/settings/mail', adminToken).expect(200),
      ).data;
      expect(read.hasPassword).toBe(true);
      expect(JSON.stringify(read)).not.toContain('super-secret-e2e');
    });

    it('PATCH lần 2 bỏ trống smtpPassword → mật khẩu ĐÃ LƯU không đổi', async () => {
      const [before] = await context.dataSource.query<MailSettingsRow[]>(
        'SELECT smtp_password_encrypted FROM system_mail_settings WHERE id = 1',
      );

      await patch('/settings/mail', adminToken)
        .send({
          smtpHost: 'smtp.e2e-test.local',
          smtpPort: 2525,
          smtpSecure: false,
          smtpFromEmail: 'no-reply@e2e-test.local',
        })
        .expect(200);

      const [after] = await context.dataSource.query<MailSettingsRow[]>(
        'SELECT smtp_password_encrypted FROM system_mail_settings WHERE id = 1',
      );
      expect(after.smtp_password_encrypted).toBe(
        before.smtp_password_encrypted,
      );
    });

    it('POST test khi cấu hình sai host thật → 422 MAIL_TEST_FAILED (không rơi vào 500)', async () => {
      const response = await post('/settings/mail/test', adminToken)
        .send({ to: 'someone@example.com' })
        .expect(422);

      expect(errorBody(response).error.code).toBe('MAIL_TEST_FAILED');
    }, 15000);

    it('POST test khi CHƯA cấu hình host → 422 MAIL_SETTINGS_INCOMPLETE', async () => {
      await context.dataSource.query(
        'UPDATE system_mail_settings SET smtp_host = NULL WHERE id = 1',
      );

      const response = await post('/settings/mail/test', adminToken)
        .send({ to: 'someone@example.com' })
        .expect(422);

      expect(errorBody(response).error.code).toBe('MAIL_SETTINGS_INCOMPLETE');
    });
  });
});
