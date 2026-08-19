import {
  ForbiddenException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Workbook } from 'exceljs';
import {
  ROLE_ADMIN,
  ROLE_HR_MANAGER,
  ROLE_HR_STAFF,
} from '@/common/constants/roles.constant';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { todayDateString } from '@/common/utils/date.util';
import { Contract } from '@/modules/contracts/entities/contract.entity';
import { Employee } from '@/modules/employees/entities/employee.entity';
import {
  EmployeesRepository,
  FindEmployeesOptions,
} from '@/modules/employees/employees.repository';
import { EmployeesService } from '@/modules/employees/employees.service';
import { ExportEmployeesDto } from './dto/export-employees.dto';
import {
  addStyledSheet,
  buildContentDisposition,
  DATE_NUMBER_FORMAT,
  ExcelCellValue,
  ExcelColumnSpec,
  toAsciiFilename,
  toExcelDate,
  VND_NUMBER_FORMAT,
} from './utils/excel.util';
import {
  contractTypeLabel,
  employeeStatusLabel,
  genderLabel,
} from './utils/labels.util';
import { maskBankAccount, maskCccd } from './utils/sensitive.util';

/**
 * Trần cứng số dòng của một lần xuất.
 *
 * Phân trang 100 dòng của `GET /employees` CỐ Ý không áp dụng ở đây (một file
 * 100 dòng thì vô dụng), nhưng cũng không được nạp vô hạn vào RAM: mỗi dòng
 * kéo theo hồ sơ đầy đủ + hợp đồng hiệu lực. Vượt trần thì BÁO LỖI, tuyệt đối
 * KHÔNG cắt bớt im lặng — người nhận file sẽ hành động trên nó như thể nó đầy
 * đủ, nên "thiếu dòng mà không báo" là lỗi toàn vẹn dữ liệu, không phải sự bất
 * tiện nhỏ.
 */
export const MAX_EXPORT_ROWS = 10_000;

/** Kích thước một lượt đọc DB khi gom dữ liệu xuất. */
export const EXPORT_PAGE_SIZE = 500;

/**
 * Số truy vấn hợp đồng chạy song song. Pool mysql2 mặc định nhỏ (10 kết nối)
 * nên bắn hàng nghìn promise cùng lúc chỉ làm chúng xếp hàng và giữ RAM.
 */
export const CONTRACT_LOOKUP_CONCURRENCY = 20;

/** Tên 3 sheet theo api-spec.md §19 — frontend/kế toán đọc theo tên này. */
export const SHEET_NAME_LIST = 'Danh sách';
export const SHEET_NAME_INSURANCE = 'Thông tin BH';
export const SHEET_NAME_SALARY = 'Thông tin lương';

export const EXPORT_SHEET_NAMES: string[] = [
  SHEET_NAME_LIST,
  SHEET_NAME_INSURANCE,
  SHEET_NAME_SALARY,
];

/**
 * Role được xuất Excel nhân viên (api-spec.md §19).
 *
 * CỐ Ý khai báo riêng thay vì dùng lại `EMPLOYEE_READ_ROLES`: `manager` bị loại
 * là một quyết định bảo mật của chính endpoint này (trưởng phòng xem được danh
 * sách phòng mình trên màn hình, nhưng không được rút cả phòng ra một file
 * mang đi). Nếu ai đó thêm `manager` vào `EMPLOYEE_READ_ROLES` cho màn hình
 * danh sách, quyền xuất file KHÔNG được âm thầm mở theo.
 */
export const EMPLOYEE_EXPORT_ROLES: string[] = [
  ROLE_ADMIN,
  ROLE_HR_MANAGER,
  ROLE_HR_STAFF,
];

/**
 * Role được xuất bản ĐẦY ĐỦ (CCCD, số tài khoản, các cột tiền).
 * Hẹp hơn `EMPLOYEE_EXPORT_ROLES` một bậc: `hr_staff` nhập liệu được nhưng
 * không được mang dữ liệu nhạy cảm của toàn công ty ra khỏi hệ thống.
 */
export const SENSITIVE_EXPORT_ROLES: string[] = [ROLE_ADMIN, ROLE_HR_MANAGER];

/** Hậu tố gắn vào tiêu đề cột tiền khi bản xuất KHÔNG chứa số liệu. */
export const HIDDEN_COLUMN_SUFFIX = ' (ẩn)';

export interface EmployeeExportResult {
  buffer: Buffer;
  /** Tên file ASCII (đã bỏ dấu) – phần `filename=` của Content-Disposition. */
  filename: string;
  /** Header `Content-Disposition` hoàn chỉnh (RFC 6266 + RFC 5987). */
  contentDisposition: string;
  /** Số nhân viên thực sự có trong file. */
  rowCount: number;
  /** true = file chứa CCCD/số tài khoản/tiền lương ở dạng gốc. */
  unmasked: boolean;
}

/** Một dòng xuất: hồ sơ + hợp đồng đang hiệu lực (nếu có). */
interface ExportRow {
  employee: Employee;
  activeContract: Contract | null;
}

@Injectable()
export class EmployeeExportService {
  private readonly logger = new Logger(EmployeeExportService.name);

  /**
   * Module `reports` KHÔNG sở hữu bảng nào nên không có repository riêng: nó
   * đọc lại đúng nguồn dữ liệu của module `employees` qua DI.
   *
   *  - `EmployeesService.resolveScope()` — phạm vi dữ liệu của người gọi. Bản
   *    xuất PHẢI đi qua đúng quy tắc này; một endpoint xuất file bỏ qua phạm vi
   *    chính là đường vòng để lấy dữ liệu mà giao diện đang từ chối hiển thị.
   *  - `EmployeesRepository` (đã được `EmployeesModule` export) — nguồn hàng
   *    loạt. `EmployeesService.findAll()` không dùng được ở đây vì nó trả
   *    `EmployeeListItemDto`, vốn CỐ Ý không chứa CCCD / số tài khoản / số sổ
   *    BHXH — đúng những cột mà sheet "Thông tin BH" và "Thông tin lương" cần.
   *    Xem báo cáo Giai đoạn: nếu module employees mở thêm một method đọc hàng
   *    loạt trả hồ sơ đầy đủ thì nên chuyển sang dùng method đó.
   */
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly employeesRepository: EmployeesRepository,
  ) {}

  async exportEmployees(
    filter: ExportEmployeesDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeExportResult> {
    // Kiểm tra quyền TRƯỚC khi chạm DB: từ chối sớm, không đọc dữ liệu nhạy
    // cảm rồi mới quyết định có được xem hay không.
    const unmasked = this.resolveSensitiveAccess(filter, user);

    const departmentScope = await this.resolveDepartmentScope(user);
    const rows = await this.loadRows(filter, departmentScope);

    const workbook = this.buildWorkbook(rows, unmasked);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    if (unmasked) {
      // Vệt kiểm toán duy nhất của tính năng này: file đã rời hệ thống, chỉ
      // còn log nói được AI lấy, LÚC NÀO và BAO NHIÊU dòng.
      // KHÔNG log giá trị CCCD/số tài khoản (CLAUDE.md §Bảo mật).
      this.logger.warn(
        `Xuất Excel nhân viên KHÔNG CHE dữ liệu nhạy cảm (CCCD, số tài khoản, lương): ` +
          `userId=${user.userId} username=${user.username} role=${user.role} ` +
          `rows=${rows.length} filters=${this.describeFilter(filter)}`,
      );
    }

    return {
      buffer,
      rowCount: rows.length,
      unmasked,
      ...this.buildFilenames(),
    };
  }

  // ------------------------------------------------------ phân quyền ----

  /**
   * `includeSensitive=true` chỉ dành cho admin/hr_manager.
   *
   * Cố tình trả 403 chứ KHÔNG âm thầm che dữ liệu khi `hr_staff` gửi cờ này:
   * người dùng cần biết file mình vừa tải về không phải thứ mình đã yêu cầu.
   */
  private resolveSensitiveAccess(
    filter: ExportEmployeesDto,
    user: AuthenticatedUser,
  ): boolean {
    if (filter.includeSensitive !== true) {
      return false;
    }

    if (!SENSITIVE_EXPORT_ROLES.includes(user.role)) {
      throw new ForbiddenException({
        code: 'SENSITIVE_EXPORT_FORBIDDEN',
        message: `Role "${user.role}" cannot export unmasked CCCD, bank account and salary columns; requires one of roles: ${SENSITIVE_EXPORT_ROLES.join(', ')}`,
      });
    }

    return true;
  }

  /**
   * Phạm vi phòng ban của người gọi, lấy từ chính `EmployeesService` để bản
   * xuất và màn hình danh sách không bao giờ lệch nhau.
   *
   * `RolesGuard` hiện đã chặn mọi role ngoài admin/hr_manager/hr_staff (tức là
   * luôn ra `kind: 'all'`), nhưng nhánh dưới đây vẫn phải có: nếu danh sách
   * role được nới ra sau này, phạm vi dữ liệu phải tự động siết theo chứ không
   * chờ ai đó nhớ sửa thêm ở đây.
   */
  private async resolveDepartmentScope(
    user: AuthenticatedUser,
  ): Promise<number[] | undefined> {
    const scope = await this.employeesService.resolveScope(user);

    if (scope.kind === 'self') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Role "${user.role}" cannot export the employee list`,
      });
    }

    return scope.kind === 'department' ? scope.departmentIds : undefined;
  }

  // ------------------------------------------------------- đọc dữ liệu ----

  private async loadRows(
    filter: ExportEmployeesDto,
    departmentScope: number[] | undefined,
  ): Promise<ExportRow[]> {
    const employees = await this.loadEmployees(filter, departmentScope);
    const contracts = await this.loadActiveContracts(employees);

    return employees.map((employee) => ({
      employee,
      activeContract: contracts.get(Number(employee.id)) ?? null,
    }));
  }

  /**
   * Đọc toàn bộ nhân viên khớp filter, theo từng lô `EXPORT_PAGE_SIZE`.
   *
   * `total` được kiểm tra ở MỌI lô chứ không chỉ lô đầu: nếu có người tạo thêm
   * hồ sơ giữa chừng và tổng vượt trần, lần xuất này phải hỏng chứ không được
   * trả về một file thiếu dòng.
   */
  private async loadEmployees(
    filter: ExportEmployeesDto,
    departmentScope: number[] | undefined,
  ): Promise<Employee[]> {
    const baseOptions = this.toFindOptions(filter, departmentScope);
    const employees: Employee[] = [];
    let total = 0;

    do {
      const [page, pageTotal] = await this.employeesRepository.findPaginated({
        ...baseOptions,
        skip: employees.length,
        take: EXPORT_PAGE_SIZE,
      });

      this.assertRowCount(pageTotal);
      total = pageTotal;

      if (page.length === 0) {
        break;
      }

      employees.push(...page);
    } while (employees.length < total);

    return employees;
  }

  /**
   * Filter của `GET /employees` được chuyển nguyên vẹn xuống repository —
   * `page`/`limit` là hai field DUY NHẤT bị bỏ qua (xem `MAX_EXPORT_ROWS`).
   */
  private toFindOptions(
    filter: ExportEmployeesDto,
    departmentScope: number[] | undefined,
  ): Omit<FindEmployeesOptions, 'skip' | 'take'> {
    const search = filter.search?.trim();

    return {
      sort: filter.sort ?? 'employeeCode',
      order: filter.order === 'desc' ? 'DESC' : 'ASC',
      search: search && search.length > 0 ? search : undefined,
      departmentId: filter.departmentId,
      positionId: filter.positionId,
      status: filter.status,
      gender: filter.gender,
      hireFrom: filter.hireFrom,
      hireTo: filter.hireTo,
      onlyDeleted: filter.onlyDeleted === true,
      departmentScope,
    };
  }

  private assertRowCount(total: number): void {
    if (total > MAX_EXPORT_ROWS) {
      throw new UnprocessableEntityException({
        code: 'EXPORT_TOO_MANY_ROWS',
        message: `The current filter matches ${total} employees, over the ${MAX_EXPORT_ROWS} row export limit; narrow the filter (department, status, hire date range) and export again`,
      });
    }
  }

  /**
   * Hợp đồng đang hiệu lực của từng nhân viên — nguồn DUY NHẤT của mọi con số
   * lương trong file (lương nằm ở `contracts`, không nằm ở `employees`).
   *
   * Dùng lại `EmployeesRepository.findActiveContract()`, đúng path mà
   * `EmployeesService.findSummary()` dùng, nên số liệu khớp với
   * `GET /employees/:id/summary`.
   *
   * ⚠️ Đây là N+1 (một truy vấn / nhân viên) và bị chặn trên bởi
   * `MAX_EXPORT_ROWS`. Muốn khử hẳn thì cần một method đọc theo lô kiểu
   * `findActiveContracts(ids[])` trên `EmployeesRepository` — thuộc module
   * khác nên không sửa ở đây.
   */
  private async loadActiveContracts(
    employees: Employee[],
  ): Promise<Map<number, Contract>> {
    const byEmployeeId = new Map<number, Contract>();

    for (
      let offset = 0;
      offset < employees.length;
      offset += CONTRACT_LOOKUP_CONCURRENCY
    ) {
      const chunk = employees.slice(
        offset,
        offset + CONTRACT_LOOKUP_CONCURRENCY,
      );
      const contracts = await Promise.all(
        chunk.map((employee) =>
          this.employeesRepository.findActiveContract(Number(employee.id)),
        ),
      );

      contracts.forEach((contract, index) => {
        if (contract) {
          byEmployeeId.set(Number(chunk[index].id), contract);
        }
      });
    }

    return byEmployeeId;
  }

  // ----------------------------------------------------------- workbook ----

  private buildWorkbook(rows: ExportRow[], unmasked: boolean): Workbook {
    const workbook = new Workbook();
    workbook.creator = 'HRM';
    workbook.created = new Date();

    // Thứ tự sheet theo api-spec.md §19.
    addStyledSheet(
      workbook,
      SHEET_NAME_LIST,
      this.listColumns(unmasked),
      rows.map((row, index) => this.listRow(row, index, unmasked)),
    );
    addStyledSheet(
      workbook,
      SHEET_NAME_INSURANCE,
      this.insuranceColumns(unmasked),
      rows.map((row, index) => this.insuranceRow(row, index, unmasked)),
    );
    addStyledSheet(
      workbook,
      SHEET_NAME_SALARY,
      this.salaryColumns(unmasked),
      rows.map((row, index) => this.salaryRow(row, index, unmasked)),
    );

    return workbook;
  }

  private listColumns(unmasked: boolean): ExcelColumnSpec[] {
    return [
      { header: 'STT', width: 6 },
      { header: 'Mã NV', width: 12 },
      { header: 'Họ và tên', width: 26 },
      { header: 'Giới tính', width: 10 },
      { header: 'Ngày sinh', width: 13, numberFormat: DATE_NUMBER_FORMAT },
      { header: 'Số CCCD', width: 16 },
      { header: 'Phòng ban', width: 24 },
      { header: 'Chức vụ', width: 24 },
      { header: 'Quản lý trực tiếp', width: 24 },
      { header: 'Trạng thái', width: 18 },
      { header: 'Ngày vào làm', width: 13, numberFormat: DATE_NUMBER_FORMAT },
      { header: 'Email công ty', width: 30 },
      { header: 'Điện thoại', width: 14 },
      { header: 'Địa chỉ thường trú', width: 40 },
      {
        header: this.moneyHeader('Lương cơ bản (VNĐ)', unmasked),
        width: 18,
        numberFormat: VND_NUMBER_FORMAT,
      },
    ];
  }

  private listRow(
    row: ExportRow,
    index: number,
    unmasked: boolean,
  ): ExcelCellValue[] {
    const { employee, activeContract } = row;

    return [
      index + 1,
      employee.employeeCode,
      employee.fullName,
      genderLabel(employee.gender),
      toExcelDate(employee.dateOfBirth),
      unmasked ? employee.cccdNumber : maskCccd(employee.cccdNumber),
      employee.department?.name ?? null,
      employee.position?.name ?? null,
      employee.directManager?.fullName ?? null,
      employeeStatusLabel(employee.status),
      toExcelDate(employee.hireDate),
      employee.email,
      employee.phone,
      employee.permanentAddress,
      this.money(activeContract?.baseSalary, unmasked),
    ];
  }

  private insuranceColumns(unmasked: boolean): ExcelColumnSpec[] {
    return [
      { header: 'STT', width: 6 },
      { header: 'Mã NV', width: 12 },
      { header: 'Họ và tên', width: 26 },
      { header: 'Ngày sinh', width: 13, numberFormat: DATE_NUMBER_FORMAT },
      { header: 'Giới tính', width: 10 },
      { header: 'Số CCCD', width: 16 },
      { header: 'Mã số thuế', width: 16 },
      { header: 'Số sổ BHXH', width: 16 },
      { header: 'Số thẻ BHYT', width: 18 },
      { header: 'Hạn thẻ BHYT', width: 14, numberFormat: DATE_NUMBER_FORMAT },
      { header: 'Phòng ban', width: 24 },
      { header: 'Ngày vào làm', width: 13, numberFormat: DATE_NUMBER_FORMAT },
      { header: 'Trạng thái', width: 18 },
      {
        header: this.moneyHeader('Lương đóng BH (VNĐ)', unmasked),
        width: 20,
        numberFormat: VND_NUMBER_FORMAT,
      },
    ];
  }

  /**
   * Mã số thuế / số sổ BHXH / số thẻ BHYT KHÔNG bị che.
   *
   * Có chủ đích: sheet này tồn tại để nộp cho cơ quan BHXH và cơ quan thuế —
   * che đúng những số đó thì sheet mất sạch công dụng. Danh sách "nhạy cảm"
   * của công ty (CLAUDE.md + PLAN Giai đoạn 8) nêu đích danh CCCD và số tài
   * khoản ngân hàng, không nêu các số này.
   */
  private insuranceRow(
    row: ExportRow,
    index: number,
    unmasked: boolean,
  ): ExcelCellValue[] {
    const { employee, activeContract } = row;

    return [
      index + 1,
      employee.employeeCode,
      employee.fullName,
      toExcelDate(employee.dateOfBirth),
      genderLabel(employee.gender),
      unmasked ? employee.cccdNumber : maskCccd(employee.cccdNumber),
      employee.taxCode,
      employee.socialInsuranceNo,
      employee.healthInsuranceNo,
      toExcelDate(employee.healthInsuranceExp),
      employee.department?.name ?? null,
      toExcelDate(employee.hireDate),
      employeeStatusLabel(employee.status),
      this.money(activeContract?.insuranceSalary, unmasked),
    ];
  }

  private salaryColumns(unmasked: boolean): ExcelColumnSpec[] {
    return [
      { header: 'STT', width: 6 },
      { header: 'Mã NV', width: 12 },
      { header: 'Họ và tên', width: 26 },
      { header: 'Phòng ban', width: 24 },
      { header: 'Chức vụ', width: 24 },
      { header: 'Số hợp đồng', width: 20 },
      { header: 'Loại hợp đồng', width: 22 },
      { header: 'Từ ngày', width: 13, numberFormat: DATE_NUMBER_FORMAT },
      { header: 'Đến ngày', width: 13, numberFormat: DATE_NUMBER_FORMAT },
      {
        header: this.moneyHeader('Lương cơ bản (VNĐ)', unmasked),
        width: 18,
        numberFormat: VND_NUMBER_FORMAT,
      },
      {
        header: this.moneyHeader('Lương đóng BH (VNĐ)', unmasked),
        width: 20,
        numberFormat: VND_NUMBER_FORMAT,
      },
      {
        header: this.moneyHeader('Phụ cấp chức vụ (VNĐ)', unmasked),
        width: 20,
        numberFormat: VND_NUMBER_FORMAT,
      },
      {
        header: this.moneyHeader('Phụ cấp khác (VNĐ)', unmasked),
        width: 20,
        numberFormat: VND_NUMBER_FORMAT,
      },
      {
        header: this.moneyHeader('Tổng thu nhập (VNĐ)', unmasked),
        width: 20,
        numberFormat: VND_NUMBER_FORMAT,
      },
      { header: 'Số tài khoản', width: 20 },
      { header: 'Ngân hàng', width: 24 },
      { header: 'Chi nhánh', width: 28 },
    ];
  }

  private salaryRow(
    row: ExportRow,
    index: number,
    unmasked: boolean,
  ): ExcelCellValue[] {
    const { employee, activeContract } = row;
    const baseSalary = this.money(activeContract?.baseSalary, unmasked);
    const positionAllowance = this.money(
      activeContract?.positionAllowance,
      unmasked,
    );
    const otherAllowance = this.money(activeContract?.otherAllowance, unmasked);

    return [
      index + 1,
      employee.employeeCode,
      employee.fullName,
      employee.department?.name ?? null,
      employee.position?.name ?? null,
      activeContract?.contractNumber ?? null,
      contractTypeLabel(activeContract?.contractType),
      toExcelDate(activeContract?.startDate),
      toExcelDate(activeContract?.endDate),
      baseSalary,
      this.money(activeContract?.insuranceSalary, unmasked),
      positionAllowance,
      otherAllowance,
      this.total(baseSalary, positionAllowance, otherAllowance),
      unmasked ? employee.bankAccount : maskBankAccount(employee.bankAccount),
      employee.bankName,
      employee.bankBranch,
    ];
  }

  // ---------------------------------------------------------- internals ----

  /**
   * Cột tiền: bản xuất mặc định KHÔNG mang theo số liệu lương (cùng quy tắc
   * role với CCCD/số tài khoản). Ô được để TRỐNG chứ không điền `***`: cột đã
   * khai báo `numFmt` tiền, nhét chuỗi vào sẽ biến nó thành cột text và làm
   * hỏng mọi công thức phía dưới.
   *
   * DECIMAL được mysql2 trả về dạng string nên phải ép `Number` (api-spec.md
   * §1.5).
   */
  private money(
    value: string | number | null | undefined,
    unmasked: boolean,
  ): number | null {
    if (!unmasked || value === null || value === undefined) {
      return null;
    }

    const amount = Number(value);

    return Number.isFinite(amount) ? amount : null;
  }

  private total(...parts: Array<number | null>): number | null {
    if (parts.every((part) => part === null)) {
      return null;
    }

    return parts.reduce<number>((sum, part) => sum + (part ?? 0), 0);
  }

  /** Tiêu đề cột tiền có gắn dấu hiệu khi số liệu bị ẩn. */
  private moneyHeader(header: string, unmasked: boolean): string {
    return unmasked ? header : `${header}${HIDDEN_COLUMN_SUFFIX}`;
  }

  private buildFilenames(): { filename: string; contentDisposition: string } {
    const date = todayDateString();
    const utf8Filename = `Danh sách nhân viên ${date}.xlsx`;
    const filename = toAsciiFilename(utf8Filename);

    return {
      filename,
      contentDisposition: buildContentDisposition(filename, utf8Filename),
    };
  }

  /** Tóm tắt filter cho log kiểm toán – không chứa dữ liệu cá nhân. */
  private describeFilter(filter: ExportEmployeesDto): string {
    const parts = [
      filter.departmentId !== undefined
        ? `departmentId=${filter.departmentId}`
        : null,
      filter.positionId !== undefined
        ? `positionId=${filter.positionId}`
        : null,
      filter.status !== undefined ? `status=${filter.status}` : null,
      filter.gender !== undefined ? `gender=${filter.gender}` : null,
      filter.hireFrom !== undefined ? `hireFrom=${filter.hireFrom}` : null,
      filter.hireTo !== undefined ? `hireTo=${filter.hireTo}` : null,
      filter.onlyDeleted === true ? 'onlyDeleted=true' : null,
      filter.search ? 'search=<đã lược bỏ>' : null,
    ].filter((part): part is string => part !== null);

    return parts.length > 0 ? parts.join(',') : 'none';
  }
}
