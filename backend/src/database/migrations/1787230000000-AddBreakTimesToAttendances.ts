import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Thêm `attendances.break_start` / `break_end` — giờ nghỉ THỰC TẾ của một ngày
 * công.
 *
 * VÌ SAO CẦN: trước đây hệ thống chỉ biết ĐỘ DÀI nghỉ trưa chuẩn (60 phút) và
 * trừ nó vào mọi ngày có ca vắt qua giờ nghỉ. Hệ quả: người làm xuyên trưa vẫn
 * bị trừ đủ 60 phút, người nghỉ 30 phút cũng bị trừ 60. Với một hệ thống mà mọi
 * dữ liệu chấm công đến từ nền tảng bên ngoài, việc đó còn tệ hơn: nếu máy chấm
 * công có ghi giờ nghỉ thật thì ta đang vứt nó đi để thay bằng một giả định.
 *
 * NULLABLE, và null KHÔNG có nghĩa là "nghỉ 0 phút": nó có nghĩa "không rõ", và
 * khi đó phép tính rơi về khung nghỉ chuẩn của công ty
 * (`BREAK_START_TIME`–`BREAK_END_TIME`). Nghỉ 0 phút được biểu diễn bằng hai
 * giờ BẰNG NHAU — đó là dữ liệu thật và phải phân biệt được với "không biết".
 *
 * KHÔNG tính lại `work_hours` của dữ liệu cũ: những con số đó đã dùng để trả
 * lương các tháng trước. Sửa lại lịch sử theo một quy tắc mới sẽ làm bảng lương
 * đã chốt không còn khớp với bảng công.
 */
export class AddBreakTimesToAttendances1787230000000 implements MigrationInterface {
  name = 'AddBreakTimesToAttendances1787230000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE attendances
        ADD COLUMN break_start TIME NULL AFTER check_out,
        ADD COLUMN break_end TIME NULL AFTER break_start
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE attendances DROP COLUMN break_end, DROP COLUMN break_start`,
    );
  }
}
