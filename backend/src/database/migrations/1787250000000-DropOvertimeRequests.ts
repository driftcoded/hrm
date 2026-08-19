import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bỏ bảng `overtime_requests` — luồng "đăng ký + duyệt làm thêm giờ" không còn.
 *
 * VÌ SAO BỎ. Bảng này được tạo với lập luận: `attendances.overtime_hours` là số
 * giờ đã ở lại làm, còn `overtime_requests` là số giờ công ty đồng ý trả tiền,
 * viện dẫn Điều 107 BLLĐ 2019 ("làm thêm giờ phải được sự đồng ý của người lao
 * động"). Lập luận đó diễn giải sai luật: yêu cầu đồng ý ở Điều 107 giới hạn
 * QUYỀN HUY ĐỘNG của người sử dụng lao động, nó không phải điều kiện để được trả
 * tiền cho công việc đã làm xong. Nhân viên đã làm thêm và công ty biết thì công
 * ty phải trả; từ chối vì "thiếu đơn duyệt" là vi phạm, không phải tuân thủ.
 *
 * Hệ quả kỹ thuật cũng tệ: hai nguồn số liệu cho cùng một đại lượng. Bảng công
 * nói 2 giờ, đơn duyệt nói 3 giờ — bảng lương lấy con số nào? Loại sai lệch này
 * rất khó phát hiện vì cả hai phía đều "có dữ liệu".
 *
 * THAY BẰNG GÌ. Giờ làm thêm suy ra từ chính bảng công: phần vượt 8 giờ/ngày,
 * hoặc toàn bộ thời gian nếu là ngày nghỉ tuần/ngày lễ. Hệ số Điều 98 và phụ trội
 * ca đêm 22h–6h (Điều 106) tính trong `common/utils/overtime.util.ts`. Cái cần
 * kiểm soát không phải là duyệt từng lần mà là các trần cứng của Điều 107
 * (12 giờ/ngày, 40 giờ/tháng, 200–300 giờ/năm) — hệ thống cảnh báo dựa trên bảng
 * công, chứ không chặn trả tiền cho giờ đã làm.
 *
 * `down()` dựng lại bảng nguyên trạng, gồm cả `recorded_by` do migration
 * 1787220000000 thêm vào, để có thể revert về đúng schema trước đó. Dữ liệu
 * trong bảng thì không lấy lại được — đây là thao tác một chiều về mặt dữ liệu.
 */
export class DropOvertimeRequests1787250000000 implements MigrationInterface {
  name = 'DropOvertimeRequests1787250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS overtime_requests;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const charset =
      'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

    await queryRunner.query(`
      CREATE TABLE overtime_requests (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        employee_id BIGINT UNSIGNED NOT NULL,
        work_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        total_hours DECIMAL(4,2) NOT NULL,
        night_hours DECIMAL(4,2) NOT NULL DEFAULT 0,
        rate_type ENUM('weekday','weekend','holiday') NOT NULL,
        rate DECIMAL(3,1) NOT NULL,
        night_rate_surcharge DECIMAL(3,1) NOT NULL DEFAULT 0,
        reason TEXT NOT NULL,
        recorded_by BIGINT UNSIGNED NULL,
        status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
        approved_by BIGINT UNSIGNED NULL,
        approved_at TIMESTAMP NULL,
        rejected_reason TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_overtime_employee_date (employee_id, work_date),
        KEY idx_overtime_status (status),
        KEY idx_overtime_work_date (work_date),
        CONSTRAINT fk_overtime_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        CONSTRAINT fk_overtime_approver FOREIGN KEY (approved_by) REFERENCES employees(id) ON DELETE SET NULL,
        CONSTRAINT fk_overtime_recorder FOREIGN KEY (recorded_by) REFERENCES employees(id) ON DELETE SET NULL
      ) ${charset};
    `);
  }
}
