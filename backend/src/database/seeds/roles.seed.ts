import { DataSource } from 'typeorm';
import { Role } from '../../modules/auth/entities/role.entity';

/** 5 roles mặc định – đúng theo docs/database-schema.md §1.1. */
export async function seedRoles(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(Role);

  const roles: Array<Pick<Role, 'id' | 'name' | 'displayName'>> = [
    { id: 1, name: 'admin', displayName: 'Quản trị hệ thống' },
    { id: 2, name: 'hr_manager', displayName: 'Trưởng phòng Nhân sự' },
    { id: 3, name: 'hr_staff', displayName: 'Nhân viên Nhân sự' },
    { id: 4, name: 'manager', displayName: 'Quản lý phòng ban' },
    { id: 5, name: 'employee', displayName: 'Nhân viên' },
  ];

  for (const role of roles) {
    const existing = await repo.findOne({ where: { name: role.name } });
    if (existing) {
      continue;
    }
    await repo.insert({
      id: role.id,
      name: role.name,
      displayName: role.displayName,
      isActive: true,
    });
  }

  console.log(`  - roles: OK (${roles.length} rows)`);
}
