import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Thêm `leave_requests.recorded_by` — ai là người GHI NHẬN đơn nghỉ phép.
 *
 * Cùng lý do với `overtime_requests.recorded_by`: nhân viên KHÔNG đăng nhập hệ
 * thống này, nên không ai tự nộp đơn. Đơn do quản lý hoặc nhân sự ghi lại hộ,
 * và `employee_id` là người ĐƯỢC nghỉ chứ không phải người nhập.
 *
 * Đây là điều kiện để giữ nguyên tắc NGƯỜI GHI ≠ NGƯỜI DUYỆT. Không có cột này
 * thì chỉ chặn được "tự duyệt đơn của chính mình" — trường hợp gần như không
 * xảy ra, vì người được nghỉ không có tài khoản. Trường hợp thật cần chặn là
 * một người vừa nhập vừa duyệt chính đơn mình nhập.
 *
 * NULLABLE: đơn tạo trước lần đổi này không biết ai nhập, và bịa ra một người
 * là làm hỏng chính thứ cột này sinh ra để ghi lại.
 */
export class AddRecordedByToLeaveRequests1787240000000 implements MigrationInterface {
  name = 'AddRecordedByToLeaveRequests1787240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE leave_requests
        ADD COLUMN recorded_by BIGINT UNSIGNED NULL AFTER reason,
        ADD CONSTRAINT fk_leave_requests_recorder
          FOREIGN KEY (recorded_by) REFERENCES employees(id) ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE leave_requests DROP FOREIGN KEY fk_leave_requests_recorder`,
    );
    await queryRunner.query(
      `ALTER TABLE leave_requests DROP COLUMN recorded_by`,
    );
  }
}
