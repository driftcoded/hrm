import { AppDataSource } from '../data-source';
import { seedRoles } from './roles.seed';
import { seedHolidays } from './holidays.seed';
import { seedLeaveTypes } from './leave-types.seed';
import { seedUsers } from './users.seed';

/**
 * Entry point for `npm run seed`.
 * Seeds infra-phase master data (roles + holidays 2025 & 2026 + the 9 legal
 * leave types of database-schema.md §5.2) plus the minimal auth data set of
 * Giai đoạn 1.1 (department/position/employees/dev accounts).
 * Provinces/districts/wards have NO dedicated table (see
 * src/common/data/vn-provinces.json instead — scope decision from phase 0.1).
 *
 * Idempotent: safe to re-run, never creates duplicates.
 */
async function main() {
  const dataSource = await AppDataSource.initialize();
  console.log('Seeding database:', dataSource.options.database);

  try {
    await seedRoles(dataSource);
    await seedHolidays(dataSource);
    await seedLeaveTypes(dataSource);
    await seedUsers(dataSource);
    console.log('Seed completed successfully.');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
