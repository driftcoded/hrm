import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bỏ cột `disciplines_rewards.amount`.
 *
 * Không phân hệ nào đọc cột này: tiền thưởng thực trả đi qua
 * `salaries.performance_bonus`, còn Điều 128 BLLĐ 2019 cấm kèm tiền vào kỷ luật.
 */
export class DropAmountFromDisciplinesRewards1787280000000 implements MigrationInterface {
  name = 'DropAmountFromDisciplinesRewards1787280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE disciplines_rewards DROP COLUMN amount;',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE disciplines_rewards ADD COLUMN amount DECIMAL(15,2) NULL AFTER effective_date;',
    );
  }
}
