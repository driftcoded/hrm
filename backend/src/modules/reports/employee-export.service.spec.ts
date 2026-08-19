import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { Workbook, Worksheet } from 'exceljs';
import type { Buffer as ExcelBuffer } from 'exceljs';
import { RolesGuard } from '@/common/guards/roles.guard';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import {
  Contract,
  ContractStatus,
  ContractType,
} from '@/modules/contracts/entities/contract.entity';
import { EmployeesRepository } from '@/modules/employees/employees.repository';
import {
  EmployeeAccessScope,
  EmployeesService,
} from '@/modules/employees/employees.service';
import {
  Employee,
  EmployeeStatus,
  Gender,
} from '@/modules/employees/entities/employee.entity';
import { ExportEmployeesDto } from './dto/export-employees.dto';
import {
  EMPLOYEE_EXPORT_ROLES,
  EmployeeExportService,
  EXPORT_SHEET_NAMES,
  HIDDEN_COLUMN_SUFFIX,
  MAX_EXPORT_ROWS,
  SHEET_NAME_INSURANCE,
  SHEET_NAME_LIST,
  SHEET_NAME_SALARY,
} from './employee-export.service';
import { ReportsController } from './reports.controller';

/** Hồ sơ tối thiểu đủ để dựng một dòng Excel. */
function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 1,
    employeeCode: 'NV0001',
    fullName: 'Nguyễn Thị Lan',
    lastName: 'Nguyễn',
    firstName: 'Thị Lan',
    dateOfBirth: '1995-03-15',
    gender: Gender.FEMALE,
    cccdNumber: '001098765432',
    taxCode: '0123456789',
    socialInsuranceNo: '0112233445',
    healthInsuranceNo: 'HS4010112233',
    healthInsuranceExp: '2027-12-31',
    permanentAddress: 'Số 10, Phố Huế, Hà Nội',
    phone: '0901234567',
    email: 'lan.nguyen@company.vn',
    bankAccount: '19001234567890',
    bankName: 'Techcombank',
    bankBranch: 'CN Hà Nội',
    hireDate: '2022-01-10',
    status: EmployeeStatus.ACTIVE,
    department: { id: 2, name: 'Phòng Kỹ thuật' },
    position: { id: 5, name: 'Kỹ sư phần mềm' },
    directManager: { id: 9, fullName: 'Trần Văn Quản' },
    ...overrides,
  } as unknown as Employee;
}

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 12,
    employeeId: 1,
    contractNumber: 'HDLD-2026-001',
    contractType: ContractType.FIXED_TERM,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    baseSalary: '15000000.00',
    insuranceSalary: '15000000.00',
    positionAllowance: '500000.00',
    otherAllowance: '200000.00',
    status: ContractStatus.ACTIVE,
    ...overrides,
  } as unknown as Contract;
}

function makeUser(role: string, overrides: Partial<AuthenticatedUser> = {}) {
  return {
    userId: 1,
    username: `${role}.user`,
    role,
    employeeId: 1,
    sessionId: 1,
    ...overrides,
  } satisfies AuthenticatedUser;
}

/**
 * Đọc lại file vừa dựng — assert trên FILE THẬT chứ không trên object trung gian.
 *
 * `xlsx.load()` khai báo tham số theo kiểu `Buffer` RIÊNG của exceljs (một
 * `ArrayBuffer`), không phải `Buffer` của Node, nên phải ép kiểu ở ranh giới.
 */
async function readWorkbook(buffer: Buffer): Promise<Workbook> {
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelBuffer);
  return workbook;
}

function headers(sheet: Worksheet): string[] {
  const values = sheet.getRow(1).values as Array<string | undefined>;
  // ExcelJS trả mảng 1-based, phần tử [0] luôn undefined.
  return values.slice(1).map((value) => String(value ?? ''));
}

function cellAt(sheet: Worksheet, row: number, header: string): unknown {
  const index = headers(sheet).indexOf(header);
  expect(index).toBeGreaterThanOrEqual(0);
  return sheet.getRow(row).getCell(index + 1).value;
}

describe('EmployeeExportService', () => {
  let service: EmployeeExportService;
  let employeesService: { resolveScope: jest.Mock };
  let employeesRepository: {
    findPaginated: jest.Mock;
    findActiveContract: jest.Mock;
  };

  const givenEmployees = (employees: Employee[], total = employees.length) => {
    employeesRepository.findPaginated.mockResolvedValue([employees, total]);
  };

  beforeEach(async () => {
    employeesService = {
      resolveScope: jest
        .fn<Promise<EmployeeAccessScope>, [AuthenticatedUser]>()
        .mockResolvedValue({ kind: 'all' }),
    };
    employeesRepository = {
      findPaginated: jest.fn().mockResolvedValue([[], 0]),
      findActiveContract: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeExportService,
        { provide: EmployeesService, useValue: employeesService },
        { provide: EmployeesRepository, useValue: employeesRepository },
      ],
    }).compile();

    service = module.get(EmployeeExportService);
  });

  // ------------------------------------------------------ phân quyền ----

  describe('phạm vi dữ liệu (scope)', () => {
    it('đi qua EmployeesService.resolveScope của chính người gọi', async () => {
      const user = makeUser('admin');

      await service.exportEmployees(new ExportEmployeesDto(), user);

      expect(employeesService.resolveScope).toHaveBeenCalledWith(user);
    });

    it('truyền departmentScope xuống repository khi phạm vi là phòng ban', async () => {
      employeesService.resolveScope.mockResolvedValue({
        kind: 'department',
        departmentIds: [2, 7],
      });

      await service.exportEmployees(
        new ExportEmployeesDto(),
        makeUser('manager'),
      );

      expect(employeesRepository.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ departmentScope: [2, 7] }),
      );
    });

    it('KHÔNG giới hạn phòng ban khi phạm vi là toàn công ty', async () => {
      await service.exportEmployees(
        new ExportEmployeesDto(),
        makeUser('admin'),
      );

      expect(employeesRepository.findPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ departmentScope: undefined }),
      );
    });

    it('từ chối 403 khi phạm vi chỉ là hồ sơ của chính mình', async () => {
      employeesService.resolveScope.mockResolvedValue({
        kind: 'self',
        employeeId: 1,
      });

      await expect(
        service.exportEmployees(new ExportEmployeesDto(), makeUser('employee')),
      ).rejects.toThrow(ForbiddenException);
      expect(employeesRepository.findPaginated).not.toHaveBeenCalled();
    });

    it('chuyển nguyên filter của GET /employees xuống repository', async () => {
      const filter = new ExportEmployeesDto();
      Object.assign(filter, {
        departmentId: 3,
        positionId: 8,
        status: EmployeeStatus.ACTIVE,
        gender: Gender.MALE,
        hireFrom: '2024-01-01',
        hireTo: '2024-12-31',
        search: '  lan  ',
        sort: 'fullName',
        order: 'desc',
        onlyDeleted: true,
        // page/limit CỐ Ý bị bỏ qua – bản xuất không phân trang.
        page: 3,
        limit: 10,
      });

      await service.exportEmployees(filter, makeUser('admin'));

      expect(employeesRepository.findPaginated).toHaveBeenCalledWith({
        departmentId: 3,
        positionId: 8,
        status: EmployeeStatus.ACTIVE,
        gender: Gender.MALE,
        hireFrom: '2024-01-01',
        hireTo: '2024-12-31',
        search: 'lan',
        sort: 'fullName',
        order: 'DESC',
        onlyDeleted: true,
        departmentScope: undefined,
        skip: 0,
        take: expect.any(Number) as number,
      });
    });
  });

  describe('cờ includeSensitive', () => {
    it.each(['admin', 'hr_manager'])(
      'cho phép %s lấy bản đầy đủ',
      async (role) => {
        const filter = new ExportEmployeesDto();
        filter.includeSensitive = true;

        const result = await service.exportEmployees(filter, makeUser(role));

        expect(result.unmasked).toBe(true);
      },
    );

    it('từ chối 403 SENSITIVE_EXPORT_FORBIDDEN với hr_staff', async () => {
      const filter = new ExportEmployeesDto();
      filter.includeSensitive = true;

      await expect(
        service.exportEmployees(filter, makeUser('hr_staff')),
      ).rejects.toMatchObject({
        response: { code: 'SENSITIVE_EXPORT_FORBIDDEN' },
      });
      // Từ chối TRƯỚC khi đọc DB.
      expect(employeesRepository.findPaginated).not.toHaveBeenCalled();
    });

    it('hr_staff vẫn xuất được bản đã che', async () => {
      const result = await service.exportEmployees(
        new ExportEmployeesDto(),
        makeUser('hr_staff'),
      );

      expect(result.unmasked).toBe(false);
    });

    it('ghi log warn kèm danh tính người yêu cầu khi xuất bản không che', async () => {
      const warn = jest
        .spyOn(service['logger'], 'warn')
        .mockImplementation(() => undefined);
      const filter = new ExportEmployeesDto();
      filter.includeSensitive = true;
      givenEmployees([makeEmployee()]);

      await service.exportEmployees(
        filter,
        makeUser('admin', { userId: 42, username: 'admin' }),
      );

      expect(warn).toHaveBeenCalledTimes(1);
      const message = warn.mock.calls[0][0] as string;
      expect(message).toContain('userId=42');
      expect(message).toContain('username=admin');
      expect(message).toContain('role=admin');
      expect(message).toContain('rows=1');
      // Log kiểm toán KHÔNG được chứa chính dữ liệu nhạy cảm.
      expect(message).not.toContain('001098765432');
    });

    it('KHÔNG ghi log warn cho bản xuất đã che (mặc định)', async () => {
      const warn = jest
        .spyOn(service['logger'], 'warn')
        .mockImplementation(() => undefined);

      await service.exportEmployees(
        new ExportEmployeesDto(),
        makeUser('admin'),
      );

      expect(warn).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------- trần dòng ----

  describe('trần số dòng', () => {
    it('báo lỗi EXPORT_TOO_MANY_ROWS thay vì cắt bớt im lặng', async () => {
      givenEmployees([], MAX_EXPORT_ROWS + 1);

      await expect(
        service.exportEmployees(new ExportEmployeesDto(), makeUser('admin')),
      ).rejects.toMatchObject({
        response: { code: 'EXPORT_TOO_MANY_ROWS' },
      });
    });

    it('chấp nhận đúng bằng trần', async () => {
      const employees = [makeEmployee()];
      employeesRepository.findPaginated.mockImplementation(
        ({ skip }: { skip: number }) =>
          Promise.resolve([skip === 0 ? employees : [], MAX_EXPORT_ROWS]),
      );

      // Lô thứ hai trả rỗng ⇒ vòng lặp dừng, không treo.
      const result = await service.exportEmployees(
        new ExportEmployeesDto(),
        makeUser('admin'),
      );

      expect(result.rowCount).toBe(1);
    });

    it('đọc hết nhiều lô cho tới khi đủ total', async () => {
      const first = [makeEmployee({ id: 1, employeeCode: 'NV0001' })];
      const second = [makeEmployee({ id: 2, employeeCode: 'NV0002' })];
      employeesRepository.findPaginated.mockImplementation(
        ({ skip }: { skip: number }) =>
          Promise.resolve([skip === 0 ? first : second, 2]),
      );

      const result = await service.exportEmployees(
        new ExportEmployeesDto(),
        makeUser('admin'),
      );

      expect(result.rowCount).toBe(2);
      expect(employeesRepository.findPaginated).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------- workbook ----

  describe('workbook', () => {
    it('có đúng 3 sheet theo api-spec.md §19', async () => {
      givenEmployees([makeEmployee()]);

      const result = await service.exportEmployees(
        new ExportEmployeesDto(),
        makeUser('admin'),
      );
      const workbook = await readWorkbook(result.buffer);

      expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(
        EXPORT_SHEET_NAMES,
      );
      expect(EXPORT_SHEET_NAMES).toEqual([
        'Danh sách',
        'Thông tin BH',
        'Thông tin lương',
      ]);
    });

    it('kết quả rỗng vẫn ra file hợp lệ có tiêu đề, không phải lỗi 500', async () => {
      givenEmployees([]);

      const result = await service.exportEmployees(
        new ExportEmployeesDto(),
        makeUser('admin'),
      );
      const workbook = await readWorkbook(result.buffer);

      expect(result.rowCount).toBe(0);
      expect(result.buffer.length).toBeGreaterThan(0);
      for (const name of EXPORT_SHEET_NAMES) {
        const sheet = workbook.getWorksheet(name);
        expect(sheet).toBeDefined();
        expect(sheet!.rowCount).toBe(1);
        expect(headers(sheet!)).toContain('Mã NV');
      }
    });

    it('đóng băng + in đậm hàng tiêu đề', async () => {
      givenEmployees([makeEmployee()]);

      const result = await service.exportEmployees(
        new ExportEmployeesDto(),
        makeUser('admin'),
      );
      const sheet = (await readWorkbook(result.buffer)).getWorksheet(
        SHEET_NAME_LIST,
      )!;

      expect(sheet.getRow(1).font?.bold).toBe(true);
      expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
      expect(sheet.columns.every((column) => (column.width ?? 0) > 0)).toBe(
        true,
      );
    });

    it('ghi ngày là Date thật + định dạng DD/MM/YYYY', async () => {
      givenEmployees([makeEmployee({ hireDate: '2022-01-10' })]);

      const result = await service.exportEmployees(
        new ExportEmployeesDto(),
        makeUser('admin'),
      );
      const sheet = (await readWorkbook(result.buffer)).getWorksheet(
        SHEET_NAME_LIST,
      )!;
      const value = cellAt(sheet, 2, 'Ngày vào làm');

      expect(value).toBeInstanceOf(Date);
      expect((value as Date).toISOString().slice(0, 10)).toBe('2022-01-10');
      expect(
        sheet.getRow(2).getCell(headers(sheet).indexOf('Ngày vào làm') + 1)
          .numFmt,
      ).toBe('dd/mm/yyyy');
    });
  });

  // ------------------------------------------------------ che dữ liệu ----

  describe('che dữ liệu nhạy cảm', () => {
    beforeEach(() => {
      givenEmployees([makeEmployee()]);
      employeesRepository.findActiveContract.mockResolvedValue(makeContract());
    });

    it('mặc định: CCCD và số tài khoản bị che, cột tiền để trống', async () => {
      const result = await service.exportEmployees(
        new ExportEmployeesDto(),
        makeUser('hr_staff'),
      );
      const workbook = await readWorkbook(result.buffer);
      const list = workbook.getWorksheet(SHEET_NAME_LIST)!;
      const salary = workbook.getWorksheet(SHEET_NAME_SALARY)!;

      expect(cellAt(list, 2, 'Số CCCD')).toBe('********5432');
      expect(cellAt(salary, 2, 'Số tài khoản')).toBe('**********7890');
      expect(
        cellAt(list, 2, `Lương cơ bản (VNĐ)${HIDDEN_COLUMN_SUFFIX}`),
      ).toBeNull();
      expect(headers(salary)).toContain(
        `Tổng thu nhập (VNĐ)${HIDDEN_COLUMN_SUFFIX}`,
      );
      // Dữ liệu không nhạy cảm vẫn đầy đủ.
      expect(cellAt(salary, 2, 'Ngân hàng')).toBe('Techcombank');
      expect(cellAt(salary, 2, 'Số hợp đồng')).toBe('HDLD-2026-001');
    });

    it('includeSensitive=true: giá trị gốc + tiền là SỐ có numFmt VNĐ', async () => {
      const filter = new ExportEmployeesDto();
      filter.includeSensitive = true;

      const result = await service.exportEmployees(filter, makeUser('admin'));
      const workbook = await readWorkbook(result.buffer);
      const list = workbook.getWorksheet(SHEET_NAME_LIST)!;
      const salary = workbook.getWorksheet(SHEET_NAME_SALARY)!;

      expect(cellAt(list, 2, 'Số CCCD')).toBe('001098765432');
      expect(cellAt(salary, 2, 'Số tài khoản')).toBe('19001234567890');
      expect(cellAt(list, 2, 'Lương cơ bản (VNĐ)')).toBe(15000000);
      // Tổng = lương cơ bản + phụ cấp chức vụ + phụ cấp khác.
      expect(cellAt(salary, 2, 'Tổng thu nhập (VNĐ)')).toBe(15700000);
      expect(
        salary
          .getRow(2)
          .getCell(headers(salary).indexOf('Lương cơ bản (VNĐ)') + 1).numFmt,
      ).toBe('#,##0');
    });

    it('sheet Thông tin BH giữ nguyên MST/số sổ BHXH/số thẻ BHYT (không nằm trong danh sách nhạy cảm)', async () => {
      const result = await service.exportEmployees(
        new ExportEmployeesDto(),
        makeUser('hr_staff'),
      );
      const insurance = (await readWorkbook(result.buffer)).getWorksheet(
        SHEET_NAME_INSURANCE,
      )!;

      expect(cellAt(insurance, 2, 'Mã số thuế')).toBe('0123456789');
      expect(cellAt(insurance, 2, 'Số sổ BHXH')).toBe('0112233445');
      expect(cellAt(insurance, 2, 'Số thẻ BHYT')).toBe('HS4010112233');
      expect(cellAt(insurance, 2, 'Số CCCD')).toBe('********5432');
    });

    it('nhân viên chưa có hợp đồng hiệu lực vẫn ra dòng, cột lương trống', async () => {
      employeesRepository.findActiveContract.mockResolvedValue(null);
      const filter = new ExportEmployeesDto();
      filter.includeSensitive = true;

      const result = await service.exportEmployees(filter, makeUser('admin'));
      const salary = (await readWorkbook(result.buffer)).getWorksheet(
        SHEET_NAME_SALARY,
      )!;

      expect(salary.rowCount).toBe(2);
      expect(cellAt(salary, 2, 'Số hợp đồng')).toBeNull();
      expect(cellAt(salary, 2, 'Lương cơ bản (VNĐ)')).toBeNull();
    });
  });

  // ------------------------------------------------------------ tên file ----

  describe('tên file', () => {
    it('filename ASCII không dấu + filename* RFC 5987 giữ dấu tiếng Việt', async () => {
      const result = await service.exportEmployees(
        new ExportEmployeesDto(),
        makeUser('admin'),
      );

      expect(result.filename).toMatch(
        /^Danh-sach-nhan-vien-\d{4}-\d{2}-\d{2}\.xlsx$/,
      );
      expect(result.contentDisposition).toContain(
        `attachment; filename="${result.filename}"`,
      );
      expect(result.contentDisposition).toContain(
        "filename*=UTF-8''Danh%20s%C3%A1ch%20nh%C3%A2n%20vi%C3%AAn",
      );
    });
  });
});

describe('ReportsController – phân quyền endpoint', () => {
  const guard = new RolesGuard(new Reflector());

  const contextFor = (role: string): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user: makeUser(role) }) }),
      getHandler: () => ReportsController.prototype.exportEmployees,
      getClass: () => ReportsController,
    }) as unknown as ExecutionContext;

  it('khai báo đúng 3 role của api-spec.md §19', () => {
    expect(EMPLOYEE_EXPORT_ROLES).toEqual(['admin', 'hr_manager', 'hr_staff']);
    // `manager` bị loại có chủ đích: trưởng phòng không được rút cả phòng ra file.
    expect(EMPLOYEE_EXPORT_ROLES).not.toContain('manager');
  });

  it.each(['admin', 'hr_manager', 'hr_staff'])('cho %s đi qua', (role) => {
    expect(guard.canActivate(contextFor(role))).toBe(true);
  });

  it.each(['manager', 'employee'])('chặn %s bằng RolesGuard', (role) => {
    expect(() => guard.canActivate(contextFor(role))).toThrow(
      ForbiddenException,
    );
  });
});
