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
 *
 * ⚠️ Codes are now SERVER-GENERATED (`PB0001`, `CV0001`, `NP0001`…), so a record
 * created through the API does NOT carry the `E2E` code prefix. Two consequences
 * the whole suite depends on:
 *
 *  1. Cleanup matches the fixture prefix on `code` **or `name`** — every fixture
 *     created through the API must therefore be given an `E2E…` NAME, otherwise
 *     its row leaks and (for departments) blocks the next run with an FK error.
 *  2. Generated numbers are never reused, so each run permanently consumes some.
 *     Assertions MUST be relative (`second === first + 1`, or a `^PB\d{4}$`
 *     pattern match) — never an absolute `PB0001` — or the suite passes once and
 *     fails on every run after that.
 */
export const FIXTURE_CODE_PREFIX = 'E2E';

/** Fixture holiday is set to year 2099 to avoid colliding with the seeded 2025/2026 holiday calendar. */
export const FIXTURE_HOLIDAY_YEAR = 2099;

/** Year used for fixture leave balances (never collides with a real payroll year). */
export const FIXTURE_LEAVE_BALANCE_YEAR = 2099;

/**
 * Numeric part of a generated code: `'PB0007'` → `7`.
 * Lets tests assert RELATIVE positions (`second === first + 1`) instead of
 * absolute values that only hold on the very first run.
 *
 * `\d{4,}` rather than `\d{4}`: the padding is 4 wide, but the generator
 * deliberately widens instead of truncating past 9999.
 */
export function codeNumber(code: string, prefix: string): number {
  expect(code).toMatch(new RegExp(`^${prefix}\\d{4,}$`));

  return Number(code.slice(prefix.length));
}

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
 * Deletes every e2e master-data fixture (including soft-deleted rows, which the
 * API never resurrects but which still hold their generated code).
 *
 * Matching is on `code LIKE 'E2E%' OR name LIKE 'E2E%'`: rows inserted straight
 * into the DB carry an `E2E…` code, while rows created through the API get a
 * generated `PB####`/`CV####`/`NP####` code and can only be recognised by name.
 * Positions are additionally matched by their department, so a position created
 * under a fixture department cannot block that department's DELETE.
 *
 * Order follows the FK direction:
 * leave_balances → leave_types → employees → positions → departments.
 */
export async function cleanupMasterDataFixtures(
  dataSource: DataSource,
): Promise<void> {
  const pattern = `${FIXTURE_CODE_PREFIX}%`;

  // leave_types uses ON DELETE RESTRICT, so balances must go first.
  await dataSource.query(
    `DELETE lb FROM leave_balances lb
     JOIN leave_types lt ON lt.id = lb.leave_type_id
     WHERE lt.code LIKE ? OR lt.name LIKE ?`,
    [pattern, pattern],
  );
  await dataSource.query(
    `DELETE lb FROM leave_balances lb
     JOIN employees e ON e.id = lb.employee_id
     WHERE e.employee_code LIKE ?`,
    [pattern],
  );
  await dataSource.query(
    `DELETE FROM leave_types WHERE code LIKE ? OR name LIKE ?`,
    [pattern, pattern],
  );

  await dataSource.query(`DELETE FROM employees WHERE employee_code LIKE ?`, [
    pattern,
  ]);
  // parent_id / manager_id point at rows about to be deleted, so links first.
  await dataSource.query(
    `UPDATE departments SET manager_id = NULL, parent_id = NULL
     WHERE code LIKE ? OR name LIKE ?`,
    [pattern, pattern],
  );
  await dataSource.query(
    `DELETE FROM positions
     WHERE code LIKE ? OR name LIKE ?
        OR department_id IN (
             SELECT id FROM departments WHERE code LIKE ? OR name LIKE ?
           )`,
    [pattern, pattern, pattern, pattern],
  );
  await dataSource.query(
    `DELETE FROM departments WHERE code LIKE ? OR name LIKE ?`,
    [pattern, pattern],
  );

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
 * Fixture leave type inserted straight into the DB, so the test can choose the
 * `code` (a legacy-style one that the `NP####` generator must ignore) and the
 * `is_system` flag.
 *
 * `is_system` fixtures exist because the nine statutory seed rows must survive
 * the run untouched: proving that a statutory type is editable/deletable is done
 * on our own row, never on `ANNUAL`.
 */
export async function insertFixtureLeaveType(
  dataSource: DataSource,
  code: string,
  name: string,
  isSystem = false,
): Promise<number> {
  await dataSource.query(
    `INSERT INTO leave_types (
       code, name, days_per_year, is_paid, require_approval, min_days,
       advance_notice_days, applicable_gender, is_active, sort_order, is_system
     ) VALUES (?, ?, 3.0, TRUE, TRUE, 0.5, 1, 'all', TRUE, 99, ?)`,
    [code, name, isSystem],
  );

  return selectId(
    dataSource,
    `SELECT id FROM leave_types WHERE code = ?`,
    code,
  );
}

/**
 * Fixture leave balance – the cheapest way to make a leave type "in use" so the
 * LEAVE_TYPE_IN_USE delete guard can be exercised over HTTP.
 * `remaining_days` is a VIRTUAL generated column and must not be inserted.
 */
export async function insertFixtureLeaveBalance(
  dataSource: DataSource,
  employeeId: number,
  leaveTypeId: number,
): Promise<void> {
  await dataSource.query(
    `INSERT INTO leave_balances (employee_id, leave_type_id, year, allocated_days)
     VALUES (?, ?, ?, 12.0)`,
    [employeeId, leaveTypeId, FIXTURE_LEAVE_BALANCE_YEAR],
  );
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
