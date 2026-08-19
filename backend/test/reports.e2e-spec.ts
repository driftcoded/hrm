import { Workbook, Worksheet } from 'exceljs';
import type { Buffer as ExcelBuffer } from 'exceljs';
import * as request from 'supertest';
import { App } from 'supertest/types';
import {
  EXPORT_SHEET_NAMES,
  HIDDEN_COLUMN_SUFFIX,
  SHEET_NAME_INSURANCE,
  SHEET_NAME_LIST,
  SHEET_NAME_SALARY,
} from '@/modules/reports/employee-export.service';
import { XLSX_CONTENT_TYPE } from '@/modules/reports/utils/excel.util';
import {
  cleanupSeedRefreshTokens,
  createE2eApp,
  E2eContext,
  errorBody,
  loginData,
  SEED_PASSWORD,
  SEED_USERS,
} from './support/e2e-app';
import {
  cleanupReportFixtures,
  insertRptActiveContract,
  insertRptDepartment,
  insertRptEmployee,
  insertRptPosition,
  RPT_CONTRACT_PREFIX,
  RPT_PREFIX,
  rptCccd,
} from './support/report-fixtures';

const EXPORT_URL = '/api/v1/reports/employees/export';

/** Nhân viên fixture CÓ hợp đồng đang hiệu lực. */
const WITH_CONTRACT = {
  suffix: '0001',
  fullName: 'Xuất Excel Một',
  bankAccount: '19001234567890',
  taxCode: '9940000001',
  socialInsuranceNo: '9940000001',
  healthInsuranceNo: 'HS4994000001',
};

/** Nhân viên fixture KHÔNG có hợp đồng – các cột lương phải trống, không lỗi. */
const WITHOUT_CONTRACT = {
  suffix: '0002',
  fullName: 'Xuất Excel Hai',
  bankAccount: null,
  taxCode: null,
  socialInsuranceNo: null,
  healthInsuranceNo: null,
};

const SALARY = {
  baseSalary: 21_000_000,
  insuranceSalary: 20_000_000,
  positionAllowance: 1_500_000,
  otherAllowance: 300_000,
};

async function loginAs(server: App, username: string): Promise<string> {
  const response = await request(server)
    .post('/api/v1/auth/login')
    .send({ username, password: SEED_PASSWORD })
    .expect(200);

  return loginData(response).accessToken;
}

/**
 * `xlsx.load()` khai báo tham số theo kiểu `Buffer` RIÊNG của exceljs (một
 * `ArrayBuffer`), không phải `Buffer` của Node — ép kiểu ở ranh giới.
 */
async function parseWorkbook(body: Buffer): Promise<Workbook> {
  const workbook = new Workbook();
  await workbook.xlsx.load(body as unknown as ExcelBuffer);
  return workbook;
}

function headers(sheet: Worksheet): string[] {
  const values = sheet.getRow(1).values as Array<string | undefined>;
  // ExcelJS trả mảng 1-based, phần tử [0] luôn undefined.
  return values.slice(1).map((value) => String(value ?? ''));
}

/** Số thứ tự dòng (1-based của Excel) chứa mã nhân viên cho trước. */
function rowNumberOf(sheet: Worksheet, employeeCode: string): number {
  const column = headers(sheet).indexOf('Mã NV') + 1;
  let found = 0;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && row.getCell(column).value === employeeCode) {
      found = rowNumber;
    }
  });

  expect(found).toBeGreaterThan(1);

  return found;
}

function cellOf(sheet: Worksheet, rowNumber: number, header: string): unknown {
  const index = headers(sheet).indexOf(header);
  expect(index).toBeGreaterThanOrEqual(0);

  return sheet.getRow(rowNumber).getCell(index + 1).value;
}

describe('GET /reports/employees/export (e2e)', () => {
  let context: E2eContext;
  let server: App;
  let departmentId: number;
  let adminToken: string;

  beforeAll(async () => {
    context = await createE2eApp();
    server = context.app.getHttpServer() as App;

    await cleanupReportFixtures(context.dataSource);

    departmentId = await insertRptDepartment(
      context.dataSource,
      `${RPT_PREFIX}-DEP`,
      `${RPT_PREFIX} Phòng Báo cáo`,
    );
    const positionId = await insertRptPosition(
      context.dataSource,
      `${RPT_PREFIX}-POS`,
      `${RPT_PREFIX} Chuyên viên`,
      departmentId,
    );

    const withContractId = await insertRptEmployee(
      context.dataSource,
      WITH_CONTRACT,
      departmentId,
      positionId,
    );
    await insertRptEmployee(
      context.dataSource,
      WITHOUT_CONTRACT,
      departmentId,
      positionId,
    );
    await insertRptActiveContract(
      context.dataSource,
      withContractId,
      `${RPT_CONTRACT_PREFIX}-0001`,
      SALARY,
    );

    adminToken = await loginAs(server, SEED_USERS.admin);
  });

  afterAll(async () => {
    await cleanupReportFixtures(context.dataSource);
    await cleanupSeedRefreshTokens(context.dataSource);
    await context.app.close();
  });

  /** Bản xuất giới hạn vào phòng ban fixture để assert không phụ thuộc dữ liệu khác. */
  const exportFixtureDepartment = (token: string, includeSensitive = false) =>
    request(server)
      .get(EXPORT_URL)
      .query({
        departmentId,
        ...(includeSensitive ? { includeSensitive: 'true' } : {}),
      })
      .set('Authorization', `Bearer ${token}`)
      .responseType('blob');

  // ------------------------------------------------------ phân quyền ----

  it('401 khi chưa đăng nhập', async () => {
    await request(server).get(EXPORT_URL).expect(401);
  });

  it('403 với role manager (trưởng phòng KHÔNG được rút cả phòng ra file)', async () => {
    const token = await loginAs(server, SEED_USERS.manager);

    const response = await request(server)
      .get(EXPORT_URL)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(errorBody(response).error.code).toBe('FORBIDDEN');
  });

  it('403 với role employee', async () => {
    const token = await loginAs(server, SEED_USERS.employeeA);

    const response = await request(server)
      .get(EXPORT_URL)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(errorBody(response).error.code).toBe('FORBIDDEN');
  });

  it('403 SENSITIVE_EXPORT_FORBIDDEN khi hr_staff xin bản không che', async () => {
    const token = await loginAs(server, SEED_USERS.hrStaff);

    const response = await request(server)
      .get(EXPORT_URL)
      .query({ departmentId, includeSensitive: 'true' })
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    expect(errorBody(response).error.code).toBe('SENSITIVE_EXPORT_FORBIDDEN');
  });

  // ------------------------------------------------------------- file ----

  it('200 + đúng content-type/Content-Disposition và mở được thành workbook 3 sheet', async () => {
    const response = await exportFixtureDepartment(adminToken).expect(200);

    expect(response.headers['content-type']).toContain(XLSX_CONTENT_TYPE);
    expect(response.headers['content-disposition']).toMatch(
      /^attachment; filename="Danh-sach-nhan-vien-\d{4}-\d{2}-\d{2}\.xlsx"; filename\*=UTF-8''Danh%20s%C3%A1ch/,
    );
    expect(response.headers['x-content-type-options']).toBe('nosniff');

    const workbook = await parseWorkbook(response.body as Buffer);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(
      EXPORT_SHEET_NAMES,
    );
    expect(EXPORT_SHEET_NAMES).toEqual([
      'Danh sách',
      'Thông tin BH',
      'Thông tin lương',
    ]);

    // Đúng 2 nhân viên fixture của phòng ban này (+1 hàng tiêu đề).
    for (const sheet of workbook.worksheets) {
      expect(sheet.rowCount).toBe(3);
    }
  });

  it('kết quả rỗng vẫn ra file hợp lệ có tiêu đề, không phải 500', async () => {
    const response = await request(server)
      .get(EXPORT_URL)
      .query({ departmentId, status: 'terminated' })
      .set('Authorization', `Bearer ${adminToken}`)
      .responseType('blob')
      .expect(200);

    const workbook = await parseWorkbook(response.body as Buffer);

    for (const name of EXPORT_SHEET_NAMES) {
      const sheet = workbook.getWorksheet(name);
      expect(sheet).toBeDefined();
      expect(sheet!.rowCount).toBe(1);
      expect(headers(sheet!)).toContain('Mã NV');
    }
  });

  // ------------------------------------------------------ che dữ liệu ----

  it('hr_staff nhận bản CHE: CCCD/số tài khoản bị che, cột tiền trống', async () => {
    const token = await loginAs(server, SEED_USERS.hrStaff);

    const response = await exportFixtureDepartment(token).expect(200);
    const workbook = await parseWorkbook(response.body as Buffer);
    const list = workbook.getWorksheet(SHEET_NAME_LIST)!;
    const salary = workbook.getWorksheet(SHEET_NAME_SALARY)!;
    const code = `${RPT_PREFIX}${WITH_CONTRACT.suffix}`;
    const listRow = rowNumberOf(list, code);
    const salaryRow = rowNumberOf(salary, code);

    expect(cellOf(list, listRow, 'Số CCCD')).toBe('********0001');
    expect(cellOf(salary, salaryRow, 'Số tài khoản')).toBe('**********7890');

    expect(headers(list)).toContain(
      `Lương cơ bản (VNĐ)${HIDDEN_COLUMN_SUFFIX}`,
    );
    expect(
      cellOf(list, listRow, `Lương cơ bản (VNĐ)${HIDDEN_COLUMN_SUFFIX}`),
    ).toBeNull();

    // Dữ liệu không nhạy cảm vẫn nguyên vẹn.
    expect(cellOf(salary, salaryRow, 'Số hợp đồng')).toBe(
      `${RPT_CONTRACT_PREFIX}-0001`,
    );
    expect(cellOf(salary, salaryRow, 'Ngân hàng')).toBe('Techcombank');
  });

  it('admin + includeSensitive=true nhận giá trị gốc và tiền là SỐ', async () => {
    const response = await exportFixtureDepartment(adminToken, true).expect(
      200,
    );
    const workbook = await parseWorkbook(response.body as Buffer);
    const list = workbook.getWorksheet(SHEET_NAME_LIST)!;
    const salary = workbook.getWorksheet(SHEET_NAME_SALARY)!;
    const insurance = workbook.getWorksheet(SHEET_NAME_INSURANCE)!;
    const code = `${RPT_PREFIX}${WITH_CONTRACT.suffix}`;
    const listRow = rowNumberOf(list, code);
    const salaryRow = rowNumberOf(salary, code);
    const insuranceRow = rowNumberOf(insurance, code);

    expect(cellOf(list, listRow, 'Số CCCD')).toBe(
      rptCccd(WITH_CONTRACT.suffix),
    );
    expect(cellOf(salary, salaryRow, 'Số tài khoản')).toBe(
      WITH_CONTRACT.bankAccount,
    );

    expect(cellOf(list, listRow, 'Lương cơ bản (VNĐ)')).toBe(SALARY.baseSalary);
    expect(cellOf(salary, salaryRow, 'Tổng thu nhập (VNĐ)')).toBe(
      SALARY.baseSalary + SALARY.positionAllowance + SALARY.otherAllowance,
    );
    expect(cellOf(insurance, insuranceRow, 'Lương đóng BH (VNĐ)')).toBe(
      SALARY.insuranceSalary,
    );

    // Ngày là Date thật, không phải chuỗi.
    const hireDate = cellOf(list, listRow, 'Ngày vào làm');
    expect(hireDate).toBeInstanceOf(Date);
    expect((hireDate as Date).toISOString().slice(0, 10)).toBe('2024-01-02');
  });

  it('nhân viên chưa có hợp đồng vẫn có dòng, cột hợp đồng/lương để trống', async () => {
    const response = await exportFixtureDepartment(adminToken, true).expect(
      200,
    );
    const salary = (await parseWorkbook(response.body as Buffer)).getWorksheet(
      SHEET_NAME_SALARY,
    )!;
    const rowNumber = rowNumberOf(
      salary,
      `${RPT_PREFIX}${WITHOUT_CONTRACT.suffix}`,
    );

    expect(cellOf(salary, rowNumber, 'Số hợp đồng')).toBeNull();
    expect(cellOf(salary, rowNumber, 'Lương cơ bản (VNĐ)')).toBeNull();
    expect(cellOf(salary, rowNumber, 'Số tài khoản')).toBeNull();
  });

  // ---------------------------------------------------------- filter ----

  it('không phân trang: filter khớp bao nhiêu thì xuất bấy nhiêu (bỏ qua limit)', async () => {
    const response = await request(server)
      .get(EXPORT_URL)
      .query({ departmentId, limit: 1, page: 2 })
      .set('Authorization', `Bearer ${adminToken}`)
      .responseType('blob')
      .expect(200);

    const list = (await parseWorkbook(response.body as Buffer)).getWorksheet(
      SHEET_NAME_LIST,
    )!;

    expect(list.rowCount).toBe(3);
  });

  it('filter search dùng chung định nghĩa với GET /employees', async () => {
    const response = await request(server)
      .get(EXPORT_URL)
      .query({ departmentId, search: WITH_CONTRACT.fullName })
      .set('Authorization', `Bearer ${adminToken}`)
      .responseType('blob')
      .expect(200);

    const list = (await parseWorkbook(response.body as Buffer)).getWorksheet(
      SHEET_NAME_LIST,
    )!;

    expect(list.rowCount).toBe(2);
    expect(cellOf(list, 2, 'Mã NV')).toBe(
      `${RPT_PREFIX}${WITH_CONTRACT.suffix}`,
    );
  });

  it('400 VALIDATION_ERROR khi filter sai kiểu', async () => {
    const response = await request(server)
      .get(EXPORT_URL)
      .query({ status: 'khong-ton-tai' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    expect(errorBody(response).error.code).toBe('VALIDATION_ERROR');
  });
});
