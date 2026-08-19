import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EmployeeStatsDto } from './dto/employee-stats.dto';
import {
  EMPLOYEE_READ_ROLES,
  ROLE_MANAGER,
} from '@/common/constants/roles.constant';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import {
  addYears,
  calculateAge,
  toDateOnlyString,
  toIsoString,
  todayDateString,
} from '@/common/utils/date.util';
import { resolvePagination } from '@/common/utils/pagination.util';
import { normalizePhone } from '@/common/validators/vn-identity.validator';
import { StorageService } from '@/shared/storage/storage.service';
import { UploadedFileLike } from '@/shared/storage/image-file.util';
import { Contract } from '@/modules/contracts/entities/contract.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import {
  AvatarUploadResponseDto,
  EmployeeDetailDto,
  EmployeeListItemDto,
  EmployeeRefDto,
  EmployeeSummaryContractDto,
  EmployeeSummaryDto,
  RestoreResponseDto,
} from './dto/employee-response.dto';
import { FilterEmployeeDto } from './dto/filter-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import {
  EMPLOYEE_CODE_DIGITS,
  EMPLOYEE_CODE_PREFIX,
  EmployeesRepository,
  EmployeeUniqueField,
} from './employees.repository';
import { Employee, EmployeeStatus, Gender } from './entities/employee.entity';

/** Tuổi hợp lệ của nhân viên (database-schema.md §2.3 – Validation tầng App). */
export const MIN_EMPLOYEE_AGE = 15;
export const MAX_EMPLOYEE_AGE = 70;

/** Số lần thử lại khi 2 request cùng giành một `employee_code`. */
const EMPLOYEE_CODE_MAX_ATTEMPTS = 5;

/**
 * Cửa sổ "sắp tới" của `GET /employees/stats`: hợp đồng sắp hết hạn, hết hạn
 * thử việc, sinh nhật sắp tới. Một tháng là khoảng HR còn kịp xử lý.
 */
export const STATS_WINDOW_DAYS = 30;

/** Cửa sổ "vừa tuyển" — cố định 30 ngày để nhãn "30 ngày qua" luôn đúng. */
export const HIRED_WINDOW_DAYS = 30;

/** Số người tối đa trong danh sách sinh nhật (panel bên phải chỉ đủ chỗ vài dòng). */
export const UPCOMING_BIRTHDAY_LIMIT = 5;

/** `29.37…` → `29.4`; giữ nguyên `null` khi chưa có nhân viên nào. */
function roundToOneDecimal(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

/** Map cột UNIQUE → error code của api-spec.md §21. */
const DUPLICATE_CODES: Record<EmployeeUniqueField, string> = {
  cccdNumber: 'DUPLICATE_CCCD',
  email: 'DUPLICATE_EMAIL',
  taxCode: 'DUPLICATE_TAX_CODE',
  socialInsuranceNo: 'DUPLICATE_SI_NUMBER',
  healthInsuranceNo: 'DUPLICATE_HI_NUMBER',
};

/**
 * Phạm vi dữ liệu nhân viên mà một tài khoản được nhìn thấy
 * (docs/architecture.md §7.3).
 */
export type EmployeeAccessScope =
  | { kind: 'all' }
  | { kind: 'department'; departmentIds: number[] }
  | { kind: 'self'; employeeId: number };

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private readonly employeesRepository: EmployeesRepository,
    private readonly storageService: StorageService,
  ) {}

  // ------------------------------------------------------------- đọc ----

  async findAll(
    filter: FilterEmployeeDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<EmployeeListItemDto>> {
    const scope = await this.resolveScope(user);

    if (scope.kind === 'self') {
      // Nhân viên thường không có quyền xem danh sách; họ dùng /employees/me.
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Role "${user.role}" cannot list employees; use GET /employees/me instead`,
      });
    }

    const { page, limit, skip } = resolvePagination(filter);
    const search = filter.search?.trim();

    const [employees, total] = await this.employeesRepository.findPaginated({
      skip,
      take: limit,
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
      departmentScope:
        scope.kind === 'department' ? scope.departmentIds : undefined,
    });

    // Một truy vấn phụ cho cả trang, không phải mỗi dòng một truy vấn.
    const baseSalaries = await this.loadBaseSalaries(employees);

    return new PaginatedResponseDto(
      employees.map((employee) => this.toListItem(employee, baseSalaries)),
      total,
      page,
      limit,
    );
  }

  /**
   * `GET /employees/stats` – số liệu cho các thẻ tổng quan của màn hình
   * `/employees`.
   *
   * Mọi con số đều được tính TRONG PHẠM VI của role gọi nó: manager chỉ thấy
   * thống kê phòng ban mình, đúng như danh sách họ xem được. Nếu không, tổng
   * số nhân viên toàn công ty sẽ rò rỉ qua một endpoint khác.
   */
  async findStats(user: AuthenticatedUser): Promise<EmployeeStatsDto> {
    const scope = await this.resolveScope(user);

    if (scope.kind === 'self') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Role "${user.role}" cannot read employee statistics`,
      });
    }

    const departmentScope =
      scope.kind === 'department' ? scope.departmentIds : undefined;
    const days = STATS_WINDOW_DAYS;

    const [
      total,
      statusCounts,
      genderCounts,
      contractsExpiringSoon,
      hiredLast30Days,
      probationEndingSoon,
      averages,
      byDepartment,
      birthdays,
    ] = await Promise.all([
      this.employeesRepository.countAll(departmentScope),
      this.employeesRepository.countByStatus(departmentScope),
      this.employeesRepository.countByGender(departmentScope),
      this.employeesRepository.countContractsExpiringWithinDays(
        days,
        departmentScope,
      ),
      this.employeesRepository.countHiredWithinDays(
        HIRED_WINDOW_DAYS,
        departmentScope,
      ),
      this.employeesRepository.countProbationEndingWithinDays(
        days,
        departmentScope,
      ),
      this.employeesRepository.findAverages(departmentScope),
      this.employeesRepository.countByDepartment(departmentScope),
      this.employeesRepository.findUpcomingBirthdays(
        days,
        UPCOMING_BIRTHDAY_LIMIT,
        departmentScope,
      ),
    ]);

    // Mọi trạng thái đều có mặt với giá trị 0, để frontend không phải đoán xem
    // "thiếu key" nghĩa là 0 hay là lỗi.
    const byStatus = Object.values(EmployeeStatus).reduce(
      (accumulator, status) => {
        accumulator[status] =
          statusCounts.find((row) => row.status === status)?.count ?? 0;
        return accumulator;
      },
      {} as Record<EmployeeStatus, number>,
    );

    const genderOf = (gender: Gender): number =>
      genderCounts.find((row) => row.gender === gender)?.count ?? 0;

    return {
      total,
      byStatus,
      contractsExpiringSoon,
      windowDays: days,
      hiredLast30Days,
      probationEndingSoon,
      byGender: {
        male: genderOf(Gender.MALE),
        female: genderOf(Gender.FEMALE),
        other: genderOf(Gender.OTHER),
      },
      averageAge: roundToOneDecimal(averages.averageAge),
      averageTenureYears: roundToOneDecimal(averages.averageTenureYears),
      byDepartment,
      upcomingBirthdays: birthdays,
    };
  }

  async findOne(
    id: number,
    user: AuthenticatedUser,
  ): Promise<EmployeeDetailDto> {
    const employee = await this.getExistingOrThrow(id);
    await this.assertCanAccess(employee, user);

    return this.toDetail(employee);
  }

  /** `GET /employees/me` – hồ sơ của chính tài khoản đang đăng nhập. */
  async findMe(user: AuthenticatedUser): Promise<EmployeeDetailDto> {
    if (user.employeeId === null || user.employeeId === undefined) {
      throw new NotFoundException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: `User ${user.userId} is not linked to an employee profile`,
      });
    }

    const employee = await this.getExistingOrThrow(Number(user.employeeId));

    return this.toDetail(employee);
  }

  /** `GET /employees/:id/summary` – dữ liệu tối thiểu để in phiếu lương. */
  async findSummary(
    id: number,
    user: AuthenticatedUser,
  ): Promise<EmployeeSummaryDto> {
    const employee = await this.getExistingOrThrow(id);
    await this.assertCanAccess(employee, user);

    const [activeDependents, activeContract] = await Promise.all([
      this.employeesRepository.countActiveDependents(id),
      this.employeesRepository.findActiveContract(id),
    ]);

    return {
      id: Number(employee.id),
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      status: employee.status,
      department: this.toRef(employee.department),
      position: this.toRef(employee.position),
      hireDate: toDateOnlyString(employee.hireDate),
      taxCode: employee.taxCode,
      socialInsuranceNo: employee.socialInsuranceNo,
      bankAccount: employee.bankAccount,
      bankName: employee.bankName,
      bankBranch: employee.bankBranch,
      activeDependents,
      activeContract: this.toSummaryContract(activeContract),
    };
  }

  // -------------------------------------------------------------- ghi ----

  async create(
    dto: CreateEmployeeDto,
    createdBy: number | null,
  ): Promise<EmployeeDetailDto> {
    const values = this.normalizeInput(dto);

    this.assertBirthDate(values.dateOfBirth);
    this.assertHireDate(values.hireDate, values.dateOfBirth);
    this.assertDateOrder(values.probationStartDate, values.probationEndDate, {
      startField: 'probationStartDate',
      endField: 'probationEndDate',
    });

    await this.assertUniqueFields({
      cccdNumber: values.cccdNumber,
      email: values.email,
      taxCode: values.taxCode,
      socialInsuranceNo: values.socialInsuranceNo,
      healthInsuranceNo: values.healthInsuranceNo,
    });

    await this.assertPositionMatchesDepartment(
      dto.positionId,
      dto.departmentId,
    );

    if (values.directManagerId !== null) {
      await this.assertManagerExists(values.directManagerId);
    }

    const created = await this.createWithGeneratedCode({
      ...values,
      fullName: this.composeFullName(values.lastName, values.firstName),
      positionId: dto.positionId,
      departmentId: dto.departmentId,
      createdBy,
    });

    return this.toDetail(await this.getExistingOrThrow(Number(created.id)));
  }

  async update(id: number, dto: UpdateEmployeeDto): Promise<EmployeeDetailDto> {
    const employee = await this.getExistingOrThrow(id);
    const patch = this.buildUpdatePatch(dto, employee);

    // ---- kiểm tra nghiệp vụ trên GIÁ TRỊ SAU KHI GỘP ----
    const dateOfBirth = patch.dateOfBirth ?? employee.dateOfBirth;
    const hireDate = patch.hireDate ?? employee.hireDate;

    if (patch.dateOfBirth !== undefined) {
      this.assertBirthDate(dateOfBirth);
    }

    if (patch.dateOfBirth !== undefined || patch.hireDate !== undefined) {
      this.assertHireDate(hireDate, dateOfBirth);
    }

    this.assertDateOrder(
      patch.probationStartDate ?? employee.probationStartDate,
      patch.probationEndDate ?? employee.probationEndDate,
      { startField: 'probationStartDate', endField: 'probationEndDate' },
    );

    this.assertDateOrder(
      hireDate,
      patch.terminationDate ?? employee.terminationDate,
      { startField: 'hireDate', endField: 'terminationDate' },
    );

    await this.assertUniqueFields(
      {
        cccdNumber: patch.cccdNumber,
        email: patch.email,
        taxCode: patch.taxCode,
        socialInsuranceNo: patch.socialInsuranceNo,
        healthInsuranceNo: patch.healthInsuranceNo,
      },
      id,
    );

    const departmentId = patch.departmentId ?? Number(employee.departmentId);
    const positionId = patch.positionId ?? Number(employee.positionId);

    if (patch.departmentId !== undefined || patch.positionId !== undefined) {
      await this.assertPositionMatchesDepartment(positionId, departmentId);
    }

    if (patch.directManagerId !== undefined && patch.directManagerId !== null) {
      if (patch.directManagerId === id) {
        throw new UnprocessableEntityException({
          code: 'EMPLOYEE_SELF_MANAGER',
          message: `Employee ${id} cannot be their own direct manager`,
        });
      }
      await this.assertManagerExists(patch.directManagerId);
    }

    if (patch.lastName !== undefined || patch.firstName !== undefined) {
      patch.fullName = this.composeFullName(
        patch.lastName ?? employee.lastName,
        patch.firstName ?? employee.firstName,
      );
    }

    if (Object.keys(patch).length > 0) {
      await this.employeesRepository.update(id, patch);
    }

    return this.toDetail(await this.getExistingOrThrow(id));
  }

  /**
   * Xoá mềm hồ sơ. Dữ liệu liên quan (hợp đồng, chấm công, lương) KHÔNG bị
   * đụng tới — hồ sơ chỉ biến mất khỏi các danh sách thường và có thể khôi phục.
   */
  async remove(id: number): Promise<{ id: number; deleted: boolean }> {
    await this.getExistingOrThrow(id);
    await this.employeesRepository.softDelete(id);

    this.logger.log(`Đã xoá mềm hồ sơ nhân viên ${id}`);

    return { id, deleted: true };
  }

  /** Khôi phục hồ sơ đã xoá mềm (`deleted_at` → NULL). */
  async restore(id: number): Promise<RestoreResponseDto> {
    const employee = await this.employeesRepository.findByIdWithDeleted(id);

    if (!employee) {
      throw new NotFoundException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: `Cannot find employee with id ${id}`,
      });
    }

    if (employee.deletedAt === null) {
      throw new UnprocessableEntityException({
        code: 'EMPLOYEE_NOT_DELETED',
        message: `Employee ${id} is not deleted, nothing to restore`,
      });
    }

    await this.employeesRepository.restore(id);
    this.logger.log(`Đã khôi phục hồ sơ nhân viên ${id}`);

    return { id, restored: true };
  }

  /**
   * Upload avatar. Ảnh cũ được xoá SAU khi ghi URL mới thành công: nếu bước
   * dọn rác hỏng thì hồ sơ vẫn trỏ đúng ảnh mới.
   */
  async uploadAvatar(
    id: number,
    file: UploadedFileLike | undefined,
    user: AuthenticatedUser,
  ): Promise<AvatarUploadResponseDto> {
    const employee = await this.getExistingOrThrow(id);
    await this.assertCanAccess(employee, user, {
      // api-spec.md §3: "Employee upload ảnh của chính mình".
      allowSelf: true,
    });

    const previousUrl = employee.avatarUrl;
    const stored = await this.storageService.putEmployeeAvatar(id, file);

    await this.employeesRepository.update(id, { avatarUrl: stored.url });

    if (previousUrl && previousUrl !== stored.url) {
      await this.storageService.removeByUrl(previousUrl);
    }

    return { avatarUrl: stored.url };
  }

  // ------------------------------------------------------ phân quyền ----

  /**
   * Phạm vi dữ liệu của tài khoản hiện tại (architecture.md §7.3):
   *  - admin / hr_manager / hr_staff → toàn bộ nhân viên
   *  - manager → nhân viên trong phòng ban của mình + phòng ban mình phụ trách
   *  - còn lại → chỉ hồ sơ của chính mình
   */
  async resolveScope(user: AuthenticatedUser): Promise<EmployeeAccessScope> {
    if (EMPLOYEE_READ_ROLES.includes(user.role)) {
      return { kind: 'all' };
    }

    const employeeId =
      user.employeeId === null || user.employeeId === undefined
        ? null
        : Number(user.employeeId);

    if (user.role === ROLE_MANAGER && employeeId !== null) {
      const managed =
        await this.employeesRepository.findManagedDepartmentIds(employeeId);
      const own = await this.employeesRepository.findById(employeeId);
      const departmentIds = new Set(managed);

      if (own) {
        departmentIds.add(Number(own.departmentId));
      }

      return { kind: 'department', departmentIds: [...departmentIds] };
    }

    if (employeeId === null) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `User ${user.userId} has no employee profile and cannot access employee records`,
      });
    }

    return { kind: 'self', employeeId };
  }

  private async assertCanAccess(
    employee: Employee,
    user: AuthenticatedUser,
    options: { allowSelf?: boolean } = {},
  ): Promise<void> {
    const scope = await this.resolveScope(user);

    if (scope.kind === 'all') {
      return;
    }

    const employeeId = Number(employee.id);

    if (scope.kind === 'department') {
      if (
        scope.departmentIds.includes(Number(employee.departmentId)) ||
        (options.allowSelf !== false &&
          user.employeeId !== null &&
          Number(user.employeeId) === employeeId)
      ) {
        return;
      }
    }

    if (scope.kind === 'self' && scope.employeeId === employeeId) {
      return;
    }

    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: `Role "${user.role}" cannot access employee ${employeeId}`,
    });
  }

  // -------------------------------------------------------- internals ----

  private async getExistingOrThrow(id: number): Promise<Employee> {
    const employee = await this.employeesRepository.findById(id);

    if (!employee) {
      throw new NotFoundException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: `Cannot find employee with id ${id}`,
      });
    }

    return employee;
  }

  /**
   * Chuẩn hoá dữ liệu đầu vào trước khi ghi: cắt khoảng trắng, hạ email về chữ
   * thường (email trong DB là UNIQUE nên `A@x.com` và `a@x.com` phải là một),
   * bỏ dấu phân cách trong SĐT.
   */
  private normalizeInput(dto: CreateEmployeeDto) {
    return {
      lastName: dto.lastName.trim(),
      firstName: dto.firstName.trim(),
      dateOfBirth: dto.dateOfBirth,
      gender: dto.gender,
      maritalStatus: dto.maritalStatus,
      nationality: dto.nationality?.trim(),
      ethnicity: dto.ethnicity?.trim(),
      religion: dto.religion?.trim() || null,
      placeOfBirth: dto.placeOfBirth.trim(),
      hometown: dto.hometown.trim(),
      cccdNumber: dto.cccdNumber,
      cccdIssueDate: dto.cccdIssueDate,
      cccdIssuePlace: dto.cccdIssuePlace.trim(),
      cccdExpiredDate: dto.cccdExpiredDate ?? null,
      taxCode: dto.taxCode ?? null,
      socialInsuranceNo: dto.socialInsuranceNo ?? null,
      healthInsuranceNo: dto.healthInsuranceNo?.toUpperCase() ?? null,
      healthInsuranceExp: dto.healthInsuranceExp ?? null,
      permanentAddress: dto.permanentAddress.trim(),
      currentAddress: dto.currentAddress?.trim() || null,
      provinceCode: dto.provinceCode,
      districtCode: dto.districtCode ?? null,
      wardCode: dto.wardCode,
      phone: normalizePhone(dto.phone),
      email: dto.email.trim().toLowerCase(),
      personalEmail: dto.personalEmail?.trim().toLowerCase() || null,
      emergencyContactName: dto.emergencyContactName?.trim() || null,
      emergencyContactPhone: dto.emergencyContactPhone
        ? normalizePhone(dto.emergencyContactPhone)
        : null,
      emergencyContactRel: dto.emergencyContactRel?.trim() || null,
      bankAccount: dto.bankAccount ?? null,
      bankName: dto.bankName?.trim() || null,
      bankBranch: dto.bankBranch?.trim() || null,
      directManagerId: dto.directManagerId ?? null,
      hireDate: dto.hireDate,
      probationStartDate: dto.probationStartDate ?? null,
      probationEndDate: dto.probationEndDate ?? null,
      officialStartDate: dto.officialStartDate ?? null,
      status: dto.status,
      educationLevel: dto.educationLevel ?? null,
      major: dto.major?.trim() || null,
      university: dto.university?.trim() || null,
      graduationYear: dto.graduationYear ?? null,
      notes: dto.notes ?? null,
    };
  }

  /**
   * Chỉ đưa vào patch những field CÓ MẶT trong body (partial update):
   * `undefined` = không đổi, `null` = xoá giá trị.
   */
  private buildUpdatePatch(
    dto: UpdateEmployeeDto,
    employee: Employee,
  ): Partial<Employee> {
    const patch: Partial<Employee> = {};
    const set = <K extends keyof Employee>(
      key: K,
      value: Employee[K] | undefined,
    ): void => {
      if (value !== undefined) {
        patch[key] = value;
      }
    };

    set('lastName', dto.lastName?.trim());
    set('firstName', dto.firstName?.trim());
    set('dateOfBirth', dto.dateOfBirth);
    set('gender', dto.gender);
    set('maritalStatus', dto.maritalStatus);
    set('nationality', dto.nationality?.trim());
    set('ethnicity', dto.ethnicity?.trim());
    set('placeOfBirth', dto.placeOfBirth?.trim());
    set('hometown', dto.hometown?.trim());
    set('cccdNumber', dto.cccdNumber);
    set('cccdIssueDate', dto.cccdIssueDate);
    set('cccdIssuePlace', dto.cccdIssuePlace?.trim());
    set('permanentAddress', dto.permanentAddress?.trim());
    set('provinceCode', dto.provinceCode);

    set('wardCode', dto.wardCode);
    set('hireDate', dto.hireDate);
    set('status', dto.status);
    set('positionId', dto.positionId);
    set('departmentId', dto.departmentId);

    if (dto.phone !== undefined) {
      patch.phone = normalizePhone(dto.phone);
    }

    if (dto.email !== undefined) {
      patch.email = dto.email.trim().toLowerCase();
    }

    // Field nullable: `null` là giá trị hợp lệ (xoá), nên không dùng `set()`.
    // districtCode nhận null tường minh (cấp huyện đã bị bỏ) nên đi qua
    // setNullable chứ không phải set() — xem migration MakeDistrictCodeNullable.
    this.setNullable(patch, 'districtCode', dto.districtCode);
    this.setNullable(patch, 'religion', dto.religion, (v) => v.trim() || null);
    this.setNullable(patch, 'cccdExpiredDate', dto.cccdExpiredDate);
    this.setNullable(patch, 'taxCode', dto.taxCode);
    this.setNullable(patch, 'socialInsuranceNo', dto.socialInsuranceNo);
    this.setNullable(patch, 'healthInsuranceNo', dto.healthInsuranceNo, (v) =>
      v.toUpperCase(),
    );
    this.setNullable(patch, 'healthInsuranceExp', dto.healthInsuranceExp);
    this.setNullable(patch, 'currentAddress', dto.currentAddress, (v) =>
      v.trim() ? v.trim() : null,
    );
    this.setNullable(patch, 'personalEmail', dto.personalEmail, (v) =>
      v.trim().toLowerCase(),
    );
    this.setNullable(
      patch,
      'emergencyContactName',
      dto.emergencyContactName,
      (v) => v.trim() || null,
    );
    this.setNullable(
      patch,
      'emergencyContactPhone',
      dto.emergencyContactPhone,
      (v) => normalizePhone(v),
    );
    this.setNullable(
      patch,
      'emergencyContactRel',
      dto.emergencyContactRel,
      (v) => v.trim(),
    );
    this.setNullable(patch, 'bankAccount', dto.bankAccount);
    this.setNullable(patch, 'bankName', dto.bankName, (v) => v.trim() || null);
    this.setNullable(
      patch,
      'bankBranch',
      dto.bankBranch,
      (v) => v.trim() || null,
    );
    this.setNullable(patch, 'probationStartDate', dto.probationStartDate);
    this.setNullable(patch, 'probationEndDate', dto.probationEndDate);
    this.setNullable(patch, 'officialStartDate', dto.officialStartDate);
    this.setNullable(patch, 'terminationDate', dto.terminationDate);
    this.setNullable(patch, 'terminationReason', dto.terminationReason);
    this.setNullable(patch, 'terminationType', dto.terminationType);
    this.setNullable(patch, 'educationLevel', dto.educationLevel);
    this.setNullable(patch, 'major', dto.major, (v) => v.trim() || null);
    this.setNullable(
      patch,
      'university',
      dto.university,
      (v) => v.trim() || null,
    );
    this.setNullable(patch, 'graduationYear', dto.graduationYear);
    this.setNullable(patch, 'notes', dto.notes);

    if (dto.directManagerId !== undefined) {
      patch.directManagerId = dto.directManagerId ?? null;
    }

    // Không cho đổi mã nhân viên: mã đã in trên hợp đồng/phiếu lương.
    void employee;

    return patch;
  }

  private setNullable<K extends keyof Employee, V>(
    patch: Partial<Employee>,
    key: K,
    value: V | null | undefined,
    map?: (value: V) => Employee[K] | null,
  ): void {
    if (value === undefined) {
      return;
    }

    patch[key] = (
      value === null ? null : map ? map(value) : value
    ) as Employee[K];
  }

  private composeFullName(lastName: string, firstName: string): string {
    return `${lastName.trim()} ${firstName.trim()}`.replace(/\s+/g, ' ').trim();
  }

  private assertBirthDate(dateOfBirth: string): void {
    const today = todayDateString();

    if (dateOfBirth > today) {
      throw new UnprocessableEntityException({
        code: 'INVALID_DATE_OF_BIRTH',
        message: `dateOfBirth ${dateOfBirth} is in the future`,
      });
    }

    const age = calculateAge(dateOfBirth, today);

    if (age < MIN_EMPLOYEE_AGE || age > MAX_EMPLOYEE_AGE) {
      throw new UnprocessableEntityException({
        code: 'INVALID_DATE_OF_BIRTH',
        message: `Employee age must be between ${MIN_EMPLOYEE_AGE} and ${MAX_EMPLOYEE_AGE}, computed ${age} from dateOfBirth ${dateOfBirth}`,
      });
    }
  }

  /** hire_date không được sớm hơn ngày sinh + 15 năm (schema §2.3). */
  private assertHireDate(hireDate: string, dateOfBirth: string): void {
    const earliest = addYears(dateOfBirth, MIN_EMPLOYEE_AGE);

    if (hireDate < earliest) {
      throw new UnprocessableEntityException({
        code: 'INVALID_HIRE_DATE',
        message: `hireDate ${hireDate} is earlier than the minimum working age date ${earliest} (dateOfBirth + ${MIN_EMPLOYEE_AGE} years)`,
      });
    }
  }

  private assertDateOrder(
    start: string | null | undefined,
    end: string | null | undefined,
    fields: { startField: string; endField: string },
  ): void {
    if (!start || !end) {
      return;
    }

    if (toDateOnlyString(end) < toDateOnlyString(start)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_DATE_RANGE',
        message: `${fields.endField} must not be earlier than ${fields.startField}`,
      });
    }
  }

  /**
   * Kiểm tra từng cột UNIQUE trước khi ghi để trả 409 có `error.code` rõ ràng
   * thay vì để MySQL ném ER_DUP_ENTRY (500).
   * `excludeId` dùng cho PATCH: bản ghi trùng chính nó thì không tính.
   */
  private async assertUniqueFields(
    values: Partial<Record<EmployeeUniqueField, string | null | undefined>>,
    excludeId?: number,
  ): Promise<void> {
    for (const [field, value] of Object.entries(values) as Array<
      [EmployeeUniqueField, string | null | undefined]
    >) {
      if (value === null || value === undefined) {
        continue;
      }

      const existing = await this.employeesRepository.findByUniqueField(
        field,
        value,
      );

      if (!existing || Number(existing.id) === excludeId) {
        continue;
      }

      // Bản ghi đã xoá mềm vẫn giữ ràng buộc UNIQUE của MySQL: báo rõ để HR
      // biết phải khôi phục hồ sơ cũ chứ không phải tạo hồ sơ mới.
      const suffix =
        existing.deletedAt !== null
          ? ` (soft-deleted employee ${existing.id}; restore it instead of creating a duplicate)`
          : ` (employee ${existing.id})`;

      throw new ConflictException({
        code: DUPLICATE_CODES[field],
        message: `Employee ${field} "${value}" already exists${suffix}`,
      });
    }
  }

  /**
   * Chức vụ phải thuộc đúng phòng ban được gán: `positions.department_id` là
   * cột bắt buộc (schema §2.2) nên gán lệch sẽ tạo dữ liệu mâu thuẫn giữa
   * bảng lương và sơ đồ tổ chức.
   */
  private async assertPositionMatchesDepartment(
    positionId: number,
    departmentId: number,
  ): Promise<void> {
    const department =
      await this.employeesRepository.findDepartmentById(departmentId);

    if (!department) {
      throw new UnprocessableEntityException({
        code: 'DEPARTMENT_NOT_FOUND',
        message: `Cannot find department with id ${departmentId}`,
      });
    }

    const position =
      await this.employeesRepository.findPositionById(positionId);

    if (!position) {
      throw new UnprocessableEntityException({
        code: 'POSITION_NOT_FOUND',
        message: `Cannot find position with id ${positionId}`,
      });
    }

    if (Number(position.departmentId) !== Number(departmentId)) {
      throw new UnprocessableEntityException({
        code: 'POSITION_DEPARTMENT_MISMATCH',
        message: `Position ${positionId} belongs to department ${position.departmentId}, not ${departmentId}`,
      });
    }
  }

  private async assertManagerExists(managerId: number): Promise<void> {
    const count = await this.employeesRepository.countById(managerId);

    if (count === 0) {
      throw new UnprocessableEntityException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: `Cannot find employee with id ${managerId} to set as direct manager`,
      });
    }
  }

  /**
   * Sinh `employee_code` kế tiếp (`NV0001`, `NV0002`…) rồi INSERT.
   *
   * `MAX(...) + 1` không an toàn tuyệt đối khi hai HR tạo hồ sơ cùng lúc, nên
   * bắt lỗi trùng mã từ MySQL và thử lại — ràng buộc UNIQUE của DB mới là
   * trọng tài cuối cùng.
   */
  private async createWithGeneratedCode(
    data: Partial<Employee>,
  ): Promise<Employee> {
    let nextNumber =
      (await this.employeesRepository.findMaxEmployeeCodeNumber()) + 1;

    for (let attempt = 1; attempt <= EMPLOYEE_CODE_MAX_ATTEMPTS; attempt++) {
      const employeeCode = `${EMPLOYEE_CODE_PREFIX}${String(nextNumber).padStart(EMPLOYEE_CODE_DIGITS, '0')}`;

      try {
        return await this.employeesRepository.create({ ...data, employeeCode });
      } catch (error) {
        if (!this.isDuplicateEmployeeCode(error)) {
          throw error;
        }

        this.logger.warn(
          `Mã nhân viên ${employeeCode} vừa bị request khác chiếm (lần thử ${attempt}), sinh mã kế tiếp`,
        );
        nextNumber =
          (await this.employeesRepository.findMaxEmployeeCodeNumber()) + 1;
      }
    }

    throw new ConflictException({
      code: 'EMPLOYEE_CODE_CONFLICT',
      message: `Cannot allocate a unique employee code after ${EMPLOYEE_CODE_MAX_ATTEMPTS} attempts`,
    });
  }

  private isDuplicateEmployeeCode(error: unknown): boolean {
    const driverError = error as { code?: string; message?: string };

    return (
      driverError?.code === 'ER_DUP_ENTRY' &&
      (driverError.message ?? '').includes('employee_code')
    );
  }

  // --------------------------------------------------------- mapping ----

  private toRef(
    entity: { id: number; name: string } | null | undefined,
  ): EmployeeRefDto | null {
    return entity ? { id: Number(entity.id), name: entity.name } : null;
  }

  /** `employees.id` → lương cơ bản của hợp đồng đang hiệu lực (nếu có). */
  private async loadBaseSalaries(
    employees: Employee[],
  ): Promise<Map<number, number>> {
    const ids = employees.map((employee) => Number(employee.id));
    const rows = await this.employeesRepository.findActiveBaseSalaries(ids);

    return new Map(rows.map((row) => [row.employeeId, row.baseSalary]));
  }

  private toListItem(
    employee: Employee,
    baseSalaries?: Map<number, number>,
  ): EmployeeListItemDto {
    return {
      id: Number(employee.id),
      baseSalary: baseSalaries?.get(Number(employee.id)) ?? null,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      email: employee.email,
      phone: employee.phone,
      gender: employee.gender,
      dateOfBirth: toDateOnlyString(employee.dateOfBirth),
      department: this.toRef(employee.department),
      position: this.toRef(employee.position),
      status: employee.status,
      hireDate: toDateOnlyString(employee.hireDate),
      avatarUrl: employee.avatarUrl,
      deletedAt:
        employee.deletedAt === null ? null : toIsoString(employee.deletedAt),
    };
  }

  private toDetail(employee: Employee): EmployeeDetailDto {
    const nullableDate = (value: string | null): string | null =>
      value === null ? null : toDateOnlyString(value);

    return {
      ...this.toListItem(employee),
      lastName: employee.lastName,
      firstName: employee.firstName,
      maritalStatus: employee.maritalStatus,
      nationality: employee.nationality,
      ethnicity: employee.ethnicity,
      religion: employee.religion,
      placeOfBirth: employee.placeOfBirth,
      hometown: employee.hometown,
      cccdNumber: employee.cccdNumber,
      cccdIssueDate: toDateOnlyString(employee.cccdIssueDate),
      cccdIssuePlace: employee.cccdIssuePlace,
      cccdExpiredDate: nullableDate(employee.cccdExpiredDate),
      taxCode: employee.taxCode,
      socialInsuranceNo: employee.socialInsuranceNo,
      healthInsuranceNo: employee.healthInsuranceNo,
      healthInsuranceExp: nullableDate(employee.healthInsuranceExp),
      permanentAddress: employee.permanentAddress,
      currentAddress: employee.currentAddress,
      provinceCode: employee.provinceCode,
      districtCode: employee.districtCode,
      wardCode: employee.wardCode,
      personalEmail: employee.personalEmail,
      emergencyContactName: employee.emergencyContactName,
      emergencyContactPhone: employee.emergencyContactPhone,
      emergencyContactRel: employee.emergencyContactRel,
      bankAccount: employee.bankAccount,
      bankName: employee.bankName,
      bankBranch: employee.bankBranch,
      directManager: employee.directManager
        ? {
            id: Number(employee.directManager.id),
            name: employee.directManager.fullName,
          }
        : null,
      probationStartDate: nullableDate(employee.probationStartDate),
      probationEndDate: nullableDate(employee.probationEndDate),
      officialStartDate: nullableDate(employee.officialStartDate),
      terminationDate: nullableDate(employee.terminationDate),
      terminationReason: employee.terminationReason,
      terminationType: employee.terminationType,
      educationLevel: employee.educationLevel,
      major: employee.major,
      university: employee.university,
      graduationYear:
        employee.graduationYear === null
          ? null
          : Number(employee.graduationYear),
      notes: employee.notes,
      createdAt: toIsoString(employee.createdAt),
      updatedAt: toIsoString(employee.updatedAt),
    };
  }

  /** Cột DECIMAL được mysql2 trả về dạng string – API phải trả number (§1.5). */
  private toSummaryContract(
    contract: Contract | null,
  ): EmployeeSummaryContractDto | null {
    if (!contract) {
      return null;
    }

    return {
      id: Number(contract.id),
      contractNumber: contract.contractNumber,
      contractType: contract.contractType,
      startDate: toDateOnlyString(contract.startDate),
      endDate:
        contract.endDate === null ? null : toDateOnlyString(contract.endDate),
      baseSalary: Number(contract.baseSalary),
      insuranceSalary: Number(contract.insuranceSalary),
      positionAllowance: Number(contract.positionAllowance),
      otherAllowance: Number(contract.otherAllowance),
      workingHours: Number(contract.workingHours),
      workingDays: Number(contract.workingDays),
    };
  }
}
