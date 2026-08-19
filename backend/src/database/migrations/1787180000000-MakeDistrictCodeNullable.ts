import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `employees.district_code` NOT NULL -> NULL.
 *
 * WHY: Vietnam abolished the district level of local government on 01/07/2025
 * (Law 72/2025/QH15 on the Organisation of Local Government). The country now
 * has TWO tiers — 34 provinces/cities and 3,321 wards/communes/special zones —
 * so there is no district for a new hire to belong to. Keeping the column NOT
 * NULL means the form has to invent a value for an administrative level that no
 * longer exists, which is worse than storing nothing.
 *
 * WHY NOT DROP THE COLUMN: employees hired before 01/07/2025 have a real
 * district on file, and that is history worth keeping — payroll and insurance
 * records filed at the time reference it. The column stays, nullable, read-only
 * in practice. `src/common/data/vn-wards.json` also carries
 * `legacyDistrictCode` per ward, so an old record can still be mapped.
 *
 * Rolling back: `down()` can only restore NOT NULL if every row has a value, so
 * it backfills the empty ones with '' first. That is deliberately lossy-looking
 * — it exists to make the migration reversible in dev, not to reconstruct data.
 */
export class MakeDistrictCodeNullable1787180000000 implements MigrationInterface {
  name = 'MakeDistrictCodeNullable1787180000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`employees\` MODIFY \`district_code\` VARCHAR(10) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // NOT NULL is rejected while any row is NULL, so fill them first.
    await queryRunner.query(
      `UPDATE \`employees\` SET \`district_code\` = '' WHERE \`district_code\` IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employees\` MODIFY \`district_code\` VARCHAR(10) NOT NULL`,
    );
  }
}
