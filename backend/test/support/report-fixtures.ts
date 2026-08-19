import { DataSource } from 'typeorm';

/**
 * Fixtures cho bộ e2e của module `reports` (xuất Excel).
 *
 * QUY TẮC: e2e chạy trên chính DB `hrm_dev` dùng chung với server dev của chủ
 * dự án, nên TUYỆT ĐỐI không TRUNCATE bảng nào và không đụng vào dữ liệu seed
 * (`ADM`, `STAFF`, `NV0001`–`NV0006`, 8 tài khoản seed, 9 loại nghỉ phép,
 * 22 ngày lễ) cũng như ~62 nhân viên demo `@vietphattech.vn`.
 *
 * Tiền tố riêng `RPT` — CỐ Ý khác `E2E` (master data) và `E3E` (nhân viên):
 * mỗi bộ test có hàm cleanup riêng, dùng chung tiền tố thì bộ này sẽ xoá
 * fixture của bộ kia ngay giữa lần chạy.
 *
 * Khác với bộ Giai đoạn 3, nhân viên ở đây được chèn THẲNG bằng SQL nên mang
 * luôn `employee_code` tiền tố `RPT` — module reports chỉ ĐỌC, không có
 * endpoint tạo hồ sơ để đi qua.
 */
export const RPT_PREFIX = 'RPT';

/** Miền email đánh dấu nhân viên fixture. */
export const RPT_EMAIL_DOMAIN = 'rpt.local';

/** Tiền tố số hợp đồng fixture. */
export const RPT_CONTRACT_PREFIX = 'RPT-HDLD';

/**
 * Dải CCCD fixture: `0994` + 8 chữ số. Không trùng `0011…` (seed),
 * `0999…` (master data) hay `0993…` (Giai đoạn 3).
 */
export function rptCccd(suffix: string): string {
  return `0994${suffix.padStart(8, '0')}`;
}

export function rptEmail(local: string): string {
  return `${local}@${RPT_EMAIL_DOMAIN}`;
}

export interface RptEmployeeSeed {
  suffix: string;
  fullName: string;
  bankAccount: string | null;
  taxCode: string | null;
  socialInsuranceNo: string | null;
  healthInsuranceNo: string | null;
}

/**
 * Xoá sạch fixture của bộ này theo chiều khoá ngoại:
 * contracts → employees → positions → departments.
 * Chạy ở CẢ `beforeAll` và `afterAll` để suite chạy lại được nhiều lần.
 */
export async function cleanupReportFixtures(
  dataSource: DataSource,
): Promise<void> {
  const codePattern = `${RPT_PREFIX}%`;
  const emailPattern = `%@${RPT_EMAIL_DOMAIN}`;

  await dataSource.query(
    `DELETE c FROM contracts c
     JOIN employees e ON e.id = c.employee_id
     WHERE e.email LIKE ? OR e.employee_code LIKE ?`,
    [emailPattern, codePattern],
  );
  await dataSource.query(`DELETE FROM contracts WHERE contract_number LIKE ?`, [
    `${RPT_CONTRACT_PREFIX}%`,
  ]);

  await dataSource.query(
    `UPDATE employees SET direct_manager_id = NULL
     WHERE email LIKE ? OR employee_code LIKE ?`,
    [emailPattern, codePattern],
  );
  await dataSource.query(
    `UPDATE departments SET manager_id = NULL, parent_id = NULL
     WHERE code LIKE ? OR name LIKE ?`,
    [codePattern, codePattern],
  );

  await dataSource.query(
    `DELETE FROM employees WHERE email LIKE ? OR employee_code LIKE ?`,
    [emailPattern, codePattern],
  );

  await dataSource.query(
    `DELETE FROM positions
     WHERE code LIKE ? OR name LIKE ?
        OR department_id IN (
             SELECT id FROM (
               SELECT id FROM departments WHERE code LIKE ? OR name LIKE ?
             ) AS d
           )`,
    [codePattern, codePattern, codePattern, codePattern],
  );

  await dataSource.query(
    `DELETE FROM departments WHERE code LIKE ? OR name LIKE ?`,
    [codePattern, codePattern],
  );
}

export async function insertRptDepartment(
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

export async function insertRptPosition(
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

/** Hồ sơ fixture đầy đủ các cột mà 3 sheet của bản xuất cần đọc. */
export async function insertRptEmployee(
  dataSource: DataSource,
  seed: RptEmployeeSeed,
  departmentId: number,
  positionId: number,
): Promise<number> {
  const employeeCode = `${RPT_PREFIX}${seed.suffix}`;

  await dataSource.query(
    `INSERT INTO employees (
       employee_code, last_name, first_name, full_name, date_of_birth, gender,
       place_of_birth, hometown, cccd_number, cccd_issue_date, cccd_issue_place,
       tax_code, social_insurance_no, health_insurance_no, health_insurance_exp,
       permanent_address, province_code, district_code, ward_code,
       phone, email, bank_account, bank_name, bank_branch,
       position_id, department_id, hire_date, status
     ) VALUES (?, 'Nguyễn', ?, ?, '1995-01-01', 'male',
       'Hà Nội', 'Hà Nội', ?, '2021-06-15', 'Cục CS QLHC về TTXH',
       ?, ?, ?, '2027-12-31',
       'Số 1, phố Fixture, Hà Nội', '01', NULL, '10101003',
       ?, ?, ?, 'Techcombank', 'CN Hà Nội',
       ?, ?, '2024-01-02', 'active')`,
    [
      employeeCode,
      seed.fullName,
      `Nguyễn ${seed.fullName}`,
      rptCccd(seed.suffix),
      seed.taxCode,
      seed.socialInsuranceNo,
      seed.healthInsuranceNo,
      `09${seed.suffix.padStart(8, '0')}`,
      rptEmail(`rpt.${seed.suffix}`),
      seed.bankAccount,
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

/** Hợp đồng `active` – nguồn của mọi cột tiền trong bản xuất. */
export async function insertRptActiveContract(
  dataSource: DataSource,
  employeeId: number,
  contractNumber: string,
  amounts: {
    baseSalary: number;
    insuranceSalary: number;
    positionAllowance: number;
    otherAllowance: number;
  },
): Promise<void> {
  await dataSource.query(
    `INSERT INTO contracts (
       employee_id, contract_number, contract_type, start_date, end_date,
       sign_date, base_salary, insurance_salary, position_allowance,
       other_allowance, working_hours, working_days, status
     ) VALUES (?, ?, 'fixed_term', '2026-01-01', '2026-12-31',
       '2025-12-20', ?, ?, ?, ?, 8.00, 5, 'active')`,
    [
      employeeId,
      contractNumber,
      amounts.baseSalary,
      amounts.insuranceSalary,
      amounts.positionAllowance,
      amounts.otherAllowance,
    ],
  );
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
