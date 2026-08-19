import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ba việc cho phân hệ lương (PLAN giai đoạn 6):
 *
 *   1. `payroll_settings` — cấu hình lương của CÔNG TY, 1 dòng duy nhất.
 *   2. `salary_advances` — tạm ứng lương, trừ vào bảng lương của một kỳ.
 *   3. Sửa mặc định `salaries.self_deduction` 11tr → 15,5tr.
 *
 * VÌ SAO PHỤ CẤP CƠM/XE/ĐIỆN THOẠI Ở CẤP CÔNG TY. Hợp đồng lao động
 * (`contracts`) đã có `base_salary`, `insurance_salary`, `position_allowance`,
 * `other_allowance` — đó là những khoản thoả thuận riêng với từng người. Ba
 * khoản còn lại là chính sách chung, ghi trong nội quy chứ không ghi trong hợp
 * đồng, và ghi lặp vào từng hợp đồng thì đổi mức ăn ca một lần phải sửa cả trăm
 * hợp đồng. Cần khác mức cho một người cụ thể thì sửa thẳng trên dòng bảng lương
 * của tháng đó.
 *
 * VÌ SAO CÓ `minimum_wage_region`. Trần đóng BHTN là 20 × lương tối thiểu VÙNG
 * (Luật Việc làm 2025), khác trần BHXH/BHYT là 20 × mức tham chiếu. Không biết
 * công ty ở vùng nào thì không tính đúng BHTN của người lương cao — và không có
 * cột nào trong hệ thống nói ra điều đó.
 *
 * `salaries.self_deduction` là cột LƯU GIÁ TRỊ ĐÃ ÁP DỤNG, không phải hằng số
 * tra cứu: sửa mặc định chỉ đổi các dòng SINH RA TỪ NAY. Bảng lương cũ giữ
 * nguyên con số của luật lúc đó — đúng như phải thế, vì đó là chứng từ.
 */
export class CreatePayrollTables1787260000000 implements MigrationInterface {
  name = 'CreatePayrollTables1787260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const charset =
      'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

    await queryRunner.query(`
      CREATE TABLE payroll_settings (
        id TINYINT UNSIGNED NOT NULL,
        minimum_wage_region TINYINT UNSIGNED NOT NULL DEFAULT 1,
        meal_allowance DECIMAL(15,2) NOT NULL DEFAULT 730000,
        transport_allowance DECIMAL(15,2) NOT NULL DEFAULT 0,
        phone_allowance DECIMAL(15,2) NOT NULL DEFAULT 0,
        attendance_allowance DECIMAL(15,2) NOT NULL DEFAULT 0,
        pay_overtime BOOLEAN NOT NULL DEFAULT TRUE,
        updated_by BIGINT UNSIGNED NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT chk_payroll_settings_singleton CHECK (id = 1),
        CONSTRAINT chk_payroll_settings_region CHECK (minimum_wage_region BETWEEN 1 AND 4),
        CONSTRAINT fk_payroll_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      ) ${charset};
    `);

    // Vùng I và mức ăn ca 730.000 — đúng ngưỡng miễn thuế TNCN của
    // TT 111/2013/TT-BTC, để mặc định không tự tạo ra một khoản chịu thuế.
    await queryRunner.query(`
      INSERT INTO payroll_settings (id, minimum_wage_region, meal_allowance)
      VALUES (1, 1, 730000);
    `);

    /*
     * `deduct_month`/`deduct_year` là KỲ LƯƠNG bị trừ, tách khỏi `advance_date`
     * là ngày ứng tiền: ứng ngày 28/07 để trừ vào lương tháng 8 là chuyện bình
     * thường, và suy kỳ trừ từ ngày ứng sẽ đoán sai đúng những trường hợp đó.
     */
    await queryRunner.query(`
      CREATE TABLE salary_advances (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        employee_id BIGINT UNSIGNED NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        advance_date DATE NOT NULL,
        deduct_month SMALLINT NOT NULL,
        deduct_year SMALLINT NOT NULL,
        reason VARCHAR(255) NOT NULL,
        status ENUM('pending','approved','rejected','deducted','cancelled') NOT NULL DEFAULT 'pending',
        rejected_reason TEXT NULL,
        recorded_by BIGINT UNSIGNED NULL,
        approved_by BIGINT UNSIGNED NULL,
        approved_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_salary_advances_period (deduct_year, deduct_month),
        KEY idx_salary_advances_employee (employee_id, deduct_year, deduct_month),
        CONSTRAINT chk_salary_advances_amount CHECK (amount > 0),
        CONSTRAINT chk_salary_advances_month CHECK (deduct_month BETWEEN 1 AND 12),
        CONSTRAINT fk_salary_advances_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        CONSTRAINT fk_salary_advances_recorder FOREIGN KEY (recorded_by) REFERENCES employees(id) ON DELETE SET NULL,
        CONSTRAINT fk_salary_advances_approver FOREIGN KEY (approved_by) REFERENCES employees(id) ON DELETE SET NULL
      ) ${charset};
    `);

    await queryRunner.query(`
      ALTER TABLE salaries
        MODIFY COLUMN self_deduction DECIMAL(15,2) NOT NULL DEFAULT 15500000;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE salaries
        MODIFY COLUMN self_deduction DECIMAL(15,2) NOT NULL DEFAULT 11000000;
    `);
    await queryRunner.query('DROP TABLE IF EXISTS salary_advances;');
    await queryRunner.query('DROP TABLE IF EXISTS payroll_settings;');
  }
}
