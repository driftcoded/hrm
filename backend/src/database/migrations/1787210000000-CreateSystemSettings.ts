import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hai bảng cấu hình hệ thống, mỗi bảng CHỈ CÓ 1 DÒNG (`id` cố định = 1,
 * ràng buộc bằng CHECK) — không phải master data dạng danh sách.
 *
 * TÁCH RIÊNG THAY VÌ GỘP CHUNG 1 BẢNG "system_settings":
 *   - `system_branding_settings` (tên công ty/logo/favicon) phải ĐỌC ĐƯỢC
 *     công khai, không cần đăng nhập — trang /login cần hiển thị logo/tên
 *     công ty TRƯỚC KHI user có access token.
 *   - `system_mail_settings` chứa mật khẩu SMTP (mã hoá AES-256-GCM ở cột
 *     `smtp_password_encrypted` — xem common/utils/encryption.util.ts), chỉ
 *     admin mới được đọc/ghi, tuyệt đối không lộ qua endpoint public.
 * Gộp chung một bảng thì mọi query đọc branding công khai đều phải cẩn thận
 * loại trừ cột mật khẩu đã mã hoá — tách bảng loại bỏ hẳn rủi ro đó.
 *
 * `updated_by` KHÔNG NOT NULL và ON DELETE SET NULL: xoá tài khoản admin đã
 * từng sửa cấu hình không được phép kéo theo lỗi hay xoá mất cấu hình.
 */
export class CreateSystemSettings1787210000000 implements MigrationInterface {
  name = 'CreateSystemSettings1787210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const charset =
      'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

    await queryRunner.query(`
      CREATE TABLE system_branding_settings (
        id TINYINT UNSIGNED NOT NULL,
        company_name VARCHAR(150) NOT NULL DEFAULT 'HRM',
        logo_url VARCHAR(500) NULL,
        favicon_url VARCHAR(500) NULL,
        updated_by BIGINT UNSIGNED NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT chk_branding_settings_singleton CHECK (id = 1),
        CONSTRAINT fk_branding_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      ) ${charset};
    `);
    await queryRunner.query(`
      INSERT INTO system_branding_settings (id, company_name) VALUES (1, 'HRM');
    `);

    await queryRunner.query(`
      CREATE TABLE system_mail_settings (
        id TINYINT UNSIGNED NOT NULL,
        smtp_host VARCHAR(255) NULL,
        smtp_port SMALLINT UNSIGNED NULL,
        smtp_secure BOOLEAN NOT NULL DEFAULT TRUE,
        smtp_username VARCHAR(255) NULL,
        smtp_password_encrypted TEXT NULL,
        smtp_from_email VARCHAR(150) NULL,
        smtp_from_name VARCHAR(150) NULL,
        updated_by BIGINT UNSIGNED NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT chk_mail_settings_singleton CHECK (id = 1),
        CONSTRAINT fk_mail_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      ) ${charset};
    `);
    await queryRunner.query(`
      INSERT INTO system_mail_settings (id) VALUES (1);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS system_mail_settings;`);
    await queryRunner.query(`DROP TABLE IF EXISTS system_branding_settings;`);
  }
}
