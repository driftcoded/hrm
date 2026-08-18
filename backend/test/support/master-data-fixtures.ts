import * as request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { loginData, SEED_PASSWORD } from './e2e-app';

/**
 * Shared helpers for the Phase 2.1 (master data) e2e suite.
 *
 * RULE: the e2e suite runs against the `hrm_dev` database shared with the
 * project owner's dev server, so it must NEVER TRUNCATE any table and must
 * NEVER touch Phase 1 seed data (`ADM`, `STAFF`, `NV0001`-`NV0006`, the 8
 * seed accounts, the 2025/2026 holidays). Every fixture uses the `E2E`
 * prefix (or year 2099 for holidays) and is fully deleted in both
 * `beforeAll` and `afterAll` so the suite can be rerun many times.
 */
export const FIXTURE_CODE_PREFIX = 'E2E';

/** Fixture holiday is set to year 2099 to avoid colliding with the seeded 2025/2026 holiday calendar. */
export const FIXTURE_HOLIDAY_YEAR = 2099;

export interface PaginatedBody<T> {
  items: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface DeleteBody {
  id: number;
  deleted: boolean;
}

/** Logs in with a seeded account and returns the access token. */
export async function loginAs(server: App, username: string): Promise<string> {
  const response = await request(server)
    .post('/api/v1/auth/login')
    .send({ username, password: SEED_PASSWORD })
    .expect(200);

  return loginData(response).accessToken;
}

/**
 * Deletes every e2e master-data fixture (including soft-deleted records).
 * Order follows the FK direction: employees → positions → departments.
 */
export async function cleanupMasterDataFixtures(
  dataSource: DataSource,
): Promise<void> {
  const codePattern = `${FIXTURE_CODE_PREFIX}%`;

  await dataSource.query(`DELETE FROM employees WHERE employee_code LIKE ?`, [
    codePattern,
  ]);
  // manager_id / parent_id reference each other, so links must be cleared before DELETE.
  await dataSource.query(
    `UPDATE departments SET manager_id = NULL, parent_id = NULL WHERE code LIKE ?`,
    [codePattern],
  );
  await dataSource.query(`DELETE FROM positions WHERE code LIKE ?`, [
    codePattern,
  ]);
  await dataSource.query(`DELETE FROM departments WHERE code LIKE ?`, [
    codePattern,
  ]);
  await dataSource.query(`DELETE FROM leave_types WHERE code LIKE ?`, [
    codePattern,
  ]);
  await dataSource.query(`DELETE FROM holidays WHERE year = ?`, [
    FIXTURE_HOLIDAY_YEAR,
  ]);
}

/** Creates a fixture department directly via SQL (bypassing the API) → returns its id. */
export async function insertFixtureDepartment(
  dataSource: DataSource,
  code: string,
  name: string,
  parentId: number | null = null,
): Promise<number> {
  await dataSource.query(
    `INSERT INTO departments (code, name, parent_id, sort_order, is_active)
     VALUES (?, ?, ?, 0, TRUE)`,
    [code, name, parentId],
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
  level = 1,
): Promise<number> {
  await dataSource.query(
    `INSERT INTO positions (code, name, department_id, level, is_active)
     VALUES (?, ?, ?, ?, TRUE)`,
    [code, name, departmentId, level],
  );

  return selectId(dataSource, `SELECT id FROM positions WHERE code = ?`, code);
}

/**
 * Minimal fixture employee (fills every NOT NULL column on the `employees` table).
 * `suffix` must be 4 digits so `employee_code`/`cccd_number`/`email` stay unique.
 */
export async function insertFixtureEmployee(
  dataSource: DataSource,
  suffix: string,
  departmentId: number,
  positionId: number,
): Promise<number> {
  const employeeCode = `${FIXTURE_CODE_PREFIX}${suffix}`;

  await dataSource.query(
    `INSERT INTO employees (
       employee_code, last_name, first_name, full_name, date_of_birth, gender,
       place_of_birth, hometown, cccd_number, cccd_issue_date, cccd_issue_place,
       permanent_address, province_code, district_code, ward_code,
       phone, email, position_id, department_id, hire_date, status
     ) VALUES (?, 'Nguyễn', 'Fixture', 'Nguyễn Fixture', '1995-01-01', 'male',
       'Hà Nội', 'Hà Nội', ?, '2021-06-15', 'Cục CS QLHC về TTXH',
       'Số 1, phố Fixture, Hà Nội', '01', '001', '00001',
       ?, ?, ?, ?, '2024-01-02', 'active')`,
    [
      employeeCode,
      `0999${suffix.padStart(8, '0')}`,
      `09${suffix.padStart(8, '0')}`,
      `e2e.${suffix}@fixture.local`,
      positionId,
      departmentId,
    ],
  );

  return selectId(
    dataSource,
    `SELECT id FROM employees WHERE employee_code = ?`,
    employeeCode,
  );
}

/** Count of employee records (not soft-deleted) matching the given employee_code suffix. */
export async function countFixtureEmployee(
  dataSource: DataSource,
  suffix: string,
): Promise<number> {
  const rows = await dataSource.query<Array<{ total: string | number }>>(
    `SELECT COUNT(*) AS total FROM employees
     WHERE employee_code = ? AND deleted_at IS NULL`,
    [`${FIXTURE_CODE_PREFIX}${suffix}`],
  );

  return Number(rows[0].total);
}

/** `deleted_at` of a single department (null = not soft-deleted). */
export async function findDepartmentDeletedAt(
  dataSource: DataSource,
  id: number,
): Promise<Date | null> {
  const rows = await dataSource.query<Array<{ deleted_at: Date | null }>>(
    `SELECT deleted_at FROM departments WHERE id = ?`,
    [id],
  );

  return rows[0]?.deleted_at ?? null;
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
