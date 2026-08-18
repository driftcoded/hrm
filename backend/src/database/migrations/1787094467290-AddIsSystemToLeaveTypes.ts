import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `leave_types.is_system` marks the 9 statutory rows seeded by
 * `seedLeaveTypes()` (Vietnamese Labor Code, docs/business-rules.md).
 * LeaveTypesService uses it to block deleting or renaming (`code`) those
 * rows through the API — their `code` is a stable identifier that future
 * payroll/leave-balance logic will special-case by value, and deleting a
 * statutory type outright would leave HR with no way to grant it again with
 * the same identity. Numeric/description fields (daysPerYear, etc.) stay
 * editable even on system rows, since companies may grant more than the
 * legal minimum.
 */
export class AddIsSystemToLeaveTypes1787094467290 implements MigrationInterface {
  name = 'AddIsSystemToLeaveTypes1787094467290';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE leave_types
      ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT FALSE AFTER sort_order;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE leave_types DROP COLUMN is_system;
    `);
  }
}
