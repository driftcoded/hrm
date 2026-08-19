import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạm ứng thu hồi được BAO NHIÊU, không phải thu hồi HAY CHƯA.
 *
 * Trước cột này, `status = 'deducted'` là tất cả những gì hệ thống nhớ, và bảng
 * lương trừ trọn số tiền ứng bất kể tháng đó người ta nhận được bao nhiêu. Chạy
 * thử trên dữ liệu thật cho ra một phiếu lương **net âm 5 triệu**: nhân viên
 * không có ngày công nào trong kỳ, gross bằng 0, mà khoản ứng 5 triệu vẫn bị trừ
 * đủ. Một bảng lương trả về số âm nghĩa là công ty đang đòi tiền nhân viên, và
 * không ai đọc con số đó mà hiểu được vì sao.
 *
 * Có `deducted_amount` thì thu hồi được từng phần: kỳ này lấy đúng phần lương
 * còn lại chịu được, phần chưa thu nằm lại và kỳ sau lấy tiếp. Không có cột này
 * thì chỉ còn hai lựa chọn, và cả hai đều sai: trừ trọn (net âm) hoặc bỏ qua rồi
 * kỳ sau trừ lại từ đầu (thu hai lần).
 */
export class AddDeductedAmountToAdvances1787270000000 implements MigrationInterface {
  name = 'AddDeductedAmountToAdvances1787270000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE salary_advances
        ADD COLUMN deducted_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER amount;
    `);

    // Phiếu đã đánh dấu thu hồi trước khi có cột này thì coi như đã thu đủ —
    // đó đúng là điều bảng lương đã làm với chúng.
    await queryRunner.query(`
      UPDATE salary_advances SET deducted_amount = amount WHERE status = 'deducted';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE salary_advances DROP COLUMN deducted_amount;',
    );
  }
}
