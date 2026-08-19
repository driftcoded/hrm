import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bảng `overtime_requests` — đơn đăng ký + duyệt làm thêm giờ (PLAN 4.1).
 *
 * VÌ SAO PHẢI CÓ BẢNG RIÊNG, TRONG KHI `attendances` ĐÃ CÓ `overtime_hours`:
 * hai con số đó trả lời hai câu hỏi khác nhau và không được phép lẫn.
 *
 *   - `attendances.overtime_hours` = số giờ NHÂN VIÊN ĐÃ Ở LẠI LÀM, suy ra từ
 *     giờ chấm vào/ra. Đây là dữ kiện thực tế, dùng để đối chiếu và để phát
 *     hiện vi phạm trần 12 giờ/ngày.
 *   - `overtime_requests` = số giờ CÔNG TY ĐỒNG Ý TRẢ TIỀN. Điều 107 BLLĐ 2019
 *     quy định làm thêm giờ phải "được sự đồng ý của người lao động", nên nó là
 *     một thoả thuận có đăng ký và có người duyệt, không phải hệ quả của việc
 *     ai đó quên về.
 *
 * Gộp hai thứ vào một cột thì cứ ai ở lại muộn là công ty tự phát sinh nghĩa vụ
 * trả lương làm thêm — hoặc ngược lại, ca làm thêm đã duyệt nhưng quên chấm
 * công thì mất tiền. Giai đoạn 6 tính lương ĐỌC TỪ BẢNG NÀY, không đọc
 * `attendances.overtime_hours`.
 *
 * CHỐT HỆ SỐ LÚC DUYỆT (`rate`, `night_rate_surcharge`): hệ số Điều 98 (1,5×
 * ngày thường / 2× cuối tuần / 3× ngày lễ, +0,3× ca đêm) được ghi thẳng vào
 * đơn. Công ty đổi chính sách hay lịch nghỉ lễ năm sau được sửa lại thì đơn đã
 * duyệt của tháng trước vẫn giữ nguyên con số đã dùng để trả lương — giống cách
 * `salaries` lưu snapshot tỷ lệ bảo hiểm.
 *
 * KHÔNG có UNIQUE trên (employee_id, work_date): một ngày có thể có nhiều ca
 * làm thêm hợp lệ (sáng sớm và tối), và khoá cứng như vậy sẽ chặn luôn việc nộp
 * lại đơn sau khi bị từ chối. Quy tắc thật là "không được chồng giờ với đơn còn
 * hiệu lực", việc đó service kiểm vì nó phụ thuộc `status`.
 */
export class CreateOvertimeRequests1787200000000 implements MigrationInterface {
  name = 'CreateOvertimeRequests1787200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
        CONSTRAINT fk_overtime_approver FOREIGN KEY (approved_by) REFERENCES employees(id) ON DELETE SET NULL
      ) ${charset};
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS overtime_requests;`);
  }
}
