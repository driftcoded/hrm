import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Thêm `overtime_requests.recorded_by` — ai là người GHI NHẬN đơn làm thêm giờ.
 *
 * VÌ SAO CẦN: thiết kế ban đầu giả định nhân viên tự đăng ký, nên người nộp đơn
 * chính là `employee_id`. Thực tế nhân viên KHÔNG đăng nhập hệ thống này — giờ
 * làm thêm do quản lý ghi nhận CHO nhân viên phòng mình, rồi kế toán/nhân sự
 * duyệt trước khi tính lương. Hai người đó là hai người khác nhau, và
 * `employee_id` không còn nói được ai đã nhập.
 *
 * Đây là điều kiện để giữ nguyên tắc NGƯỜI GHI ≠ NGƯỜI DUYỆT. Không có cột này
 * thì hệ thống chỉ chặn được "tự duyệt đơn của chính mình" (so `employee_id`
 * với người duyệt) — mà đó lại là trường hợp gần như không xảy ra, vì người
 * hưởng giờ làm thêm không có tài khoản. Trường hợp thật cần chặn là người vừa
 * nhập vừa duyệt chính đơn mình nhập.
 *
 * NULLABLE: các đơn đã có trong DB trước lần đổi này không biết ai nhập, và bịa
 * ra một người là làm hỏng chính thứ cột này sinh ra để ghi lại. `null` đọc
 * đúng là "không rõ", và service coi đơn không rõ người nhập là duyệt được —
 * dữ liệu cũ không nên chặn quy trình hiện tại.
 */
export class AddRecordedByToOvertime1787220000000 implements MigrationInterface {
  name = 'AddRecordedByToOvertime1787220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE overtime_requests
        ADD COLUMN recorded_by BIGINT UNSIGNED NULL AFTER reason,
        ADD CONSTRAINT fk_overtime_recorder
          FOREIGN KEY (recorded_by) REFERENCES employees(id) ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE overtime_requests DROP FOREIGN KEY fk_overtime_recorder`,
    );
    await queryRunner.query(
      `ALTER TABLE overtime_requests DROP COLUMN recorded_by`,
    );
  }
}
