import { rm } from 'fs/promises';
import { resolve } from 'path';
import { DataSource } from 'typeorm';

/**
 * Fixtures cho bộ e2e Giai đoạn 3 (nhân viên / hợp đồng / gia đình).
 *
 * QUY TẮC: e2e chạy trên chính DB `hrm_dev` dùng chung với server dev của chủ
 * dự án, nên TUYỆT ĐỐI không TRUNCATE bảng nào và không đụng vào dữ liệu seed
 * của Giai đoạn 1 (`ADM`, `STAFF`, `NV0001`–`NV0006`, 8 tài khoản seed).
 *
 * Tiền tố riêng `E3E` — CỐ Ý khác `E2E` của bộ master data: hai bộ test có
 * hàm cleanup riêng, dùng chung tiền tố thì bộ này sẽ xoá fixture của bộ kia
 * ngay giữa lần chạy.
 *
 * Nhân viên tạo qua API mang mã `NV####` do SERVER sinh, không mang tiền tố
 * nào — vì vậy dấu hiệu nhận biết của bộ này là **email thuộc miền
 * `@e3e.local`**. Mọi nhân viên fixture bắt buộc dùng miền đó, nếu không dòng
 * dữ liệu sẽ ở lại DB và chặn lần chạy sau bằng lỗi khoá ngoại.
 */
export const FIXTURE_PREFIX = 'E3E';

/** Miền email đánh dấu nhân viên fixture (xem ghi chú ở trên). */
export const FIXTURE_EMAIL_DOMAIN = 'e3e.local';

/** Tiền tố số hợp đồng fixture. */
export const FIXTURE_CONTRACT_PREFIX = 'E3E-HDLD';

/**
 * Tiền tố CCCD fixture: `0993` + 8 chữ số. Không trùng dải `0011…` của seed và
 * `0999…` của bộ master data.
 */
export function fixtureCccd(suffix: string): string {
  return `0993${suffix.padStart(8, '0')}`;
}

export function fixtureEmail(local: string): string {
  return `${local}@${FIXTURE_EMAIL_DOMAIN}`;
}

export interface PaginatedBody<T> {
  items: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface DeleteBody {
  id: number;
  deleted: boolean;
}

export interface RestoreBody {
  id: number;
  restored: boolean;
}

/**
 * Xoá sạch mọi fixture của Giai đoạn 3, kể cả bản ghi đã xoá mềm (vẫn giữ
 * email/CCCD UNIQUE nên không dọn thì lần chạy sau nhận 409).
 * Thứ tự theo chiều khoá ngoại: family_members → contracts → employees →
 * positions → departments.
 */
export async function cleanupEmployeeFixtures(
  dataSource: DataSource,
): Promise<void> {
  const namePattern = `${FIXTURE_PREFIX}%`;
  const emailPattern = `%@${FIXTURE_EMAIL_DOMAIN}`;

  // Ảnh avatar do test upload nằm trên ĐĨA, không nằm trong DB: xoá dòng dữ
  // liệu thôi thì file mồ côi ở lại `uploads/avatars/<id>/` mãi mãi. Phải lấy
  // id TRƯỚC khi xoá bản ghi.
  await removeFixtureAvatars(dataSource, emailPattern);

  await dataSource.query(
    `DELETE fm FROM family_members fm
     JOIN employees e ON e.id = fm.employee_id
     WHERE e.email LIKE ?`,
    [emailPattern],
  );

  await dataSource.query(
    `DELETE d FROM dependents d
     JOIN employees e ON e.id = d.employee_id
     WHERE e.email LIKE ?`,
    [emailPattern],
  );

  await dataSource.query(
    `DELETE c FROM contracts c
     JOIN employees e ON e.id = c.employee_id
     WHERE e.email LIKE ?`,
    [emailPattern],
  );
  await dataSource.query(`DELETE FROM contracts WHERE contract_number LIKE ?`, [
    `${FIXTURE_CONTRACT_PREFIX}%`,
  ]);

  // Nhân viên fixture có thể đang là quản lý trực tiếp của nhau.
  await dataSource.query(
    `UPDATE employees SET direct_manager_id = NULL WHERE email LIKE ?`,
    [emailPattern],
  );
  await dataSource.query(
    `UPDATE departments SET manager_id = NULL, parent_id = NULL
     WHERE code LIKE ? OR name LIKE ?`,
    [namePattern, namePattern],
  );

  // Tài khoản đăng nhập fixture (bước 4 của wizard) trỏ tới nhân viên qua
  // `users.employee_id` với ON DELETE SET NULL — nhưng `username`/`email` là
  // UNIQUE nên không xoá thì lần chạy sau nhận 409.
  await dataSource.query(
    `DELETE FROM users WHERE username LIKE ? OR email LIKE ?`,
    ['e3e.%', emailPattern],
  );

  await dataSource.query(`DELETE FROM employees WHERE email LIKE ?`, [
    emailPattern,
  ]);

  await dataSource.query(
    `DELETE FROM positions
     WHERE code LIKE ? OR name LIKE ?
        OR department_id IN (
             SELECT id FROM (
               SELECT id FROM departments WHERE code LIKE ? OR name LIKE ?
             ) AS d
           )`,
    [namePattern, namePattern, namePattern, namePattern],
  );

  await dataSource.query(
    `DELETE FROM departments WHERE code LIKE ? OR name LIKE ?`,
    [namePattern, namePattern],
  );
}

/**
 * Xoá thư mục avatar của mọi nhân viên fixture (driver `local` ghi ra
 * `STORAGE_LOCAL_DIR/avatars/<employeeId>/`). Bao gồm cả bản ghi đã xoá mềm.
 */
async function removeFixtureAvatars(
  dataSource: DataSource,
  emailPattern: string,
): Promise<void> {
  const rows = await dataSource.query<Array<{ id: string | number }>>(
    `SELECT id FROM employees WHERE email LIKE ?`,
    [emailPattern],
  );

  const rootDir = resolve(
    process.cwd(),
    process.env.STORAGE_LOCAL_DIR ?? 'uploads',
    'avatars',
  );

  for (const row of rows) {
    await rm(resolve(rootDir, String(Number(row.id))), {
      recursive: true,
      force: true,
    });
  }
}

/** Phòng ban fixture, tạo thẳng bằng SQL (mã do test chọn, không qua API). */
export async function insertFixtureDepartment(
  dataSource: DataSource,
  code: string,
  name: string,
): Promise<number> {
  await dataSource.query(
    `INSERT INTO departments (code, name, sort_order, is_active)
     VALUES (?, ?, 0, TRUE)`,
    [code, name],
  );

  return selectId(
    dataSource,
    `SELECT id FROM departments WHERE code = ?`,
    code,
  );
}

export async function insertFixturePosition(
  dataSource: DataSource,
  code: string,
  name: string,
  departmentId: number,
): Promise<number> {
  await dataSource.query(
    `INSERT INTO positions (code, name, department_id, level, is_active)
     VALUES (?, ?, ?, 1, TRUE)`,
    [code, name, departmentId],
  );

  return selectId(dataSource, `SELECT id FROM positions WHERE code = ?`, code);
}

/** Gán trưởng phòng cho phòng ban fixture (dùng cho test phạm vi role manager). */
export async function setDepartmentManager(
  dataSource: DataSource,
  departmentId: number,
  employeeId: number,
): Promise<void> {
  await dataSource.query(`UPDATE departments SET manager_id = ? WHERE id = ?`, [
    employeeId,
    departmentId,
  ]);
}

/** `deleted_at` của một nhân viên (null = chưa xoá mềm). */
export async function findEmployeeDeletedAt(
  dataSource: DataSource,
  id: number,
): Promise<Date | null> {
  const rows = await dataSource.query<Array<{ deleted_at: Date | null }>>(
    `SELECT deleted_at FROM employees WHERE id = ?`,
    [id],
  );

  return rows[0]?.deleted_at ?? null;
}

/** employees.id của một tài khoản seed – để test phạm vi truy cập theo role. */
export async function findEmployeeIdByUsername(
  dataSource: DataSource,
  username: string,
): Promise<number> {
  const rows = await dataSource.query<Array<{ employee_id: string | number }>>(
    `SELECT employee_id FROM users WHERE username = ? LIMIT 1`,
    [username],
  );

  if (rows.length === 0 || rows[0].employee_id === null) {
    throw new Error(
      `Tài khoản seed "${username}" không tồn tại hoặc chưa gắn hồ sơ nhân viên. Chạy \`npm run seed\` trước.`,
    );
  }

  return Number(rows[0].employee_id);
}

/**
 * JPEG hợp lệ tối thiểu: chỉ cần magic bytes `FF D8 FF` là đủ cho
 * `detectImageKind`. `padding` để dựng file vượt ngưỡng dung lượng.
 */
export function makeJpegBuffer(padding = 64): Buffer {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.alloc(padding),
  ]);
}

async function selectId(
  dataSource: DataSource,
  sql: string,
  parameter: string,
): Promise<number> {
  const rows = await dataSource.query<Array<{ id: string | number }>>(sql, [
    parameter,
  ]);

  if (rows.length === 0) {
    throw new Error(`Fixture không được tạo: ${sql} (${parameter})`);
  }

  return Number(rows[0].id);
}
