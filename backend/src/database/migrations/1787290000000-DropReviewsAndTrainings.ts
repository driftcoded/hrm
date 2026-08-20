import { MigrationInterface, QueryRunner } from 'typeorm';

const charset = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

/**
 * Bỏ hẳn hai phân hệ đánh giá hiệu suất và đào tạo.
 *
 * Quyết định của công ty: không dùng hai phân hệ này. Giữ lại bảng rỗng nghĩa là
 * để `npm run seed` và tài liệu tiếp tục nói về thứ không tồn tại trong sản
 * phẩm, nên xoá luôn cả bảng.
 *
 * Khen thưởng / kỷ luật (`disciplines_rewards`) KHÔNG bị đụng tới — đó là phân
 * hệ riêng, vẫn đang dùng.
 *
 * `down()` dựng lại đúng schema gốc ở `InitSchema` để rollback không gãy, nhưng
 * dữ liệu trong ba bảng thì không lấy lại được.
 */
export class DropReviewsAndTrainings1787290000000 implements MigrationInterface {
  name = 'DropReviewsAndTrainings1787290000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS performance_reviews;');
    await queryRunner.query('DROP TABLE IF EXISTS employee_trainings;');
    await queryRunner.query('DROP TABLE IF EXISTS trainings;');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE trainings (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(30) NOT NULL,
        name VARCHAR(200) NOT NULL,
        type ENUM('internal','external','online','on_the_job') NOT NULL,
        description TEXT NULL,
        start_date DATE NULL,
        end_date DATE NULL,
        location VARCHAR(200) NULL,
        trainer VARCHAR(200) NULL,
        cost DECIMAL(15,2) NOT NULL DEFAULT 0,
        max_participants SMALLINT NULL,
        status ENUM('planned','ongoing','completed','cancelled') NOT NULL DEFAULT 'planned',
        attachment_url VARCHAR(500) NULL,
        note TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_trainings_code (code),
        CONSTRAINT fk_trainings_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ${charset};
    `);

    await queryRunner.query(`
      CREATE TABLE employee_trainings (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        employee_id BIGINT UNSIGNED NOT NULL,
        training_id BIGINT UNSIGNED NOT NULL,
        registration_date DATE NOT NULL,
        completion_date DATE NULL,
        result ENUM('passed','failed','incomplete','exempted') NULL,
        score DECIMAL(5,2) NULL,
        certificate_url VARCHAR(500) NULL,
        note TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_employee_training (employee_id, training_id),
        CONSTRAINT fk_employee_trainings_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        CONSTRAINT fk_employee_trainings_training FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE
      ) ${charset};
    `);

    await queryRunner.query(`
      CREATE TABLE performance_reviews (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        employee_id BIGINT UNSIGNED NOT NULL,
        reviewer_id BIGINT UNSIGNED NOT NULL,
        review_period ENUM('monthly','quarterly','biannual','annual') NOT NULL,
        period_year SMALLINT NOT NULL,
        period_quarter SMALLINT NULL,
        period_month SMALLINT NULL,
        kpi_score DECIMAL(5,2) NULL,
        attitude_score DECIMAL(5,2) NULL,
        skill_score DECIMAL(5,2) NULL,
        overall_score DECIMAL(5,2) NULL,
        rating ENUM('excellent','good','average','below_average','poor') NULL,
        strengths TEXT NULL,
        weaknesses TEXT NULL,
        recommendations TEXT NULL,
        status ENUM('draft','submitted','acknowledged') NOT NULL DEFAULT 'draft',
        acknowledged_at TIMESTAMP NULL,
        note TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_performance_reviews_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        CONSTRAINT fk_performance_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES employees(id) ON DELETE RESTRICT
      ) ${charset};
    `);
  }
}
