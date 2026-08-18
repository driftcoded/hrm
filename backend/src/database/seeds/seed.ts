import { AppDataSource } from '../data-source';
import { seedRoles } from './roles.seed';
import { seedHolidays } from './holidays.seed';

/**
 * Entry point cho `npm run seed`.
 * Chỉ seed master data infra-phase: roles + holidays (2025 & 2026).
 * Provinces/districts/wards KHÔNG có bảng riêng (xem
 * src/common/data/vn-provinces.json thay thế — quyết định scope phase 0.1).
 */
async function main() {
  const dataSource = await AppDataSource.initialize();
  console.log('Seeding database:', dataSource.options.database);

  try {
    await seedRoles(dataSource);
    await seedHolidays(dataSource);
    console.log('Seed completed successfully.');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
