import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  Contract,
  ContractStatus,
} from '@/modules/contracts/entities/contract.entity';
import { Department } from '@/modules/departments/entities/department.entity';
import {
  Dependent,
  DependentStatus,
} from '@/modules/dependents/entities/dependent.entity';
import { Position } from '@/modules/positions/entities/position.entity';
import { EmployeeSortKey } from './dto/filter-employee.dto';
import { Employee, EmployeeStatus, Gender } from './entities/employee.entity';

/** Map `sort` (whitelist ở FilterEmployeeDto) → cột SQL an toàn. */
const SORT_COLUMNS: Record<EmployeeSortKey, string> = {
  employeeCode: 'employee.employeeCode',
  fullName: 'employee.fullName',
  hireDate: 'employee.hireDate',
  status: 'employee.status',
  createdAt: 'employee.createdAt',
};

/** Tiền tố mã nhân viên tự sinh: `NV0001` (database-schema.md §2.3). */
export const EMPLOYEE_CODE_PREFIX = 'NV';
export const EMPLOYEE_CODE_DIGITS = 4;

export interface FindEmployeesOptions {
  skip: number;
  take: number;
  sort: EmployeeSortKey;
  order: 'ASC' | 'DESC';
  search?: string;
  departmentId?: number;
  positionId?: number;
  status?: EmployeeStatus;
  gender?: Gender;
  hireFrom?: string;
  hireTo?: string;
  /** Chỉ lấy hồ sơ đã xoá mềm (màn hình khôi phục). */
  onlyDeleted?: boolean;
  /**
   * Giới hạn theo phòng ban – dùng cho role `manager`
   * (architecture.md §7.3 "Nhân viên phòng ban mình").
   * `undefined` = không giới hạn; mảng rỗng = không thấy gì.
   */
  departmentScope?: number[];
}

export interface EmployeeBaseSalary {
  employeeId: number;
  baseSalary: number;
}

export interface StatusCount {
  status: EmployeeStatus;
  count: number;
}

export interface GenderCount {
  gender: Gender;
  count: number;
}

export interface DepartmentHeadcount {
  departmentId: number;
  departmentName: string;
  count: number;
}

export interface AverageStats {
  averageAge: number | null;
  averageTenureYears: number | null;
}

export interface BirthdayRow {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  avatarUrl: string | null;
  birthday: string;
  daysUntil: number;
}

/** Cột duy nhất cần kiểm tra trước khi ghi (api-spec.md §21 nhóm EMPLOYEE). */
export type EmployeeUniqueField =
  | 'cccdNumber'
  | 'email'
  | 'taxCode'
  | 'socialInsuranceNo'
  | 'healthInsuranceNo';

/**
 * Chỉ chứa TypeORM query, không có if/else nghiệp vụ (CLAUDE.md §Kiến trúc
 * module). QueryBuilder tự thêm `deleted_at IS NULL` vì entity có
 * @DeleteDateColumn → hồ sơ xoá mềm không lọt vào list/detail thường.
 */
@Injectable()
export class EmployeesRepository {
  constructor(
    @InjectRepository(Employee)
    private readonly repository: Repository<Employee>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(Position)
    private readonly positionRepository: Repository<Position>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(Dependent)
    private readonly dependentRepository: Repository<Dependent>,
  ) {}

  findPaginated(options: FindEmployeesOptions): Promise<[Employee[], number]> {
    const query = this.baseQuery()
      .orderBy(SORT_COLUMNS[options.sort], options.order)
      .addOrderBy('employee.id', 'ASC')
      .skip(options.skip)
      .take(options.take);

    if (options.onlyDeleted) {
      // `withDeleted()` bỏ điều kiện mặc định `deleted_at IS NULL`; thêm lại
      // điều kiện ngược để CHỈ còn hồ sơ đã xoá.
      query.withDeleted().andWhere('employee.deletedAt IS NOT NULL');
    }

    if (options.departmentScope) {
      if (options.departmentScope.length === 0) {
        // Không có phòng ban nào trong phạm vi → trả rỗng, KHÔNG trả tất cả.
        query.andWhere('1 = 0');
      } else {
        query.andWhere('employee.departmentId IN (:...departmentScope)', {
          departmentScope: options.departmentScope,
        });
      }
    }

    if (options.departmentId !== undefined) {
      query.andWhere('employee.departmentId = :departmentId', {
        departmentId: options.departmentId,
      });
    }

    if (options.positionId !== undefined) {
      query.andWhere('employee.positionId = :positionId', {
        positionId: options.positionId,
      });
    }

    if (options.status !== undefined) {
      query.andWhere('employee.status = :status', { status: options.status });
    }

    if (options.gender !== undefined) {
      query.andWhere('employee.gender = :gender', { gender: options.gender });
    }

    if (options.hireFrom !== undefined) {
      query.andWhere('employee.hireDate >= :hireFrom', {
        hireFrom: options.hireFrom,
      });
    }

    if (options.hireTo !== undefined) {
      query.andWhere('employee.hireDate <= :hireTo', {
        hireTo: options.hireTo,
      });
    }

    if (options.search) {
      query.andWhere(
        `(employee.fullName LIKE :search
          OR employee.employeeCode LIKE :search
          OR employee.email LIKE :search
          OR employee.cccdNumber LIKE :search)`,
        { search: `%${options.search}%` },
      );
    }

    return query.getManyAndCount();
  }

  findById(id: number): Promise<Employee | null> {
    return this.baseQuery().where('employee.id = :id', { id }).getOne();
  }

  /** Bao gồm cả hồ sơ đã xoá mềm – dùng cho restore và thông báo trùng dữ liệu. */
  findByIdWithDeleted(id: number): Promise<Employee | null> {
    return this.baseQuery()
      .withDeleted()
      .where('employee.id = :id', { id })
      .getOne();
  }

  /**
   * Tìm theo cột UNIQUE, KỂ CẢ bản ghi đã xoá mềm.
   *
   * Bắt buộc phải `withDeleted()`: xoá mềm không gỡ ràng buộc UNIQUE của MySQL,
   * nên nếu chỉ tìm trong bản ghi "sống" thì service sẽ tưởng CCCD còn trống
   * rồi INSERT và nhận lỗi 500 từ driver thay vì 409 có nghĩa.
   */
  findByUniqueField(
    field: EmployeeUniqueField,
    value: string,
  ): Promise<Employee | null> {
    return this.repository
      .createQueryBuilder('employee')
      .withDeleted()
      .where(`employee.${field} = :value`, { value })
      .getOne();
  }

  /**
   * Số lớn nhất đang dùng trong `employee_code` dạng `NV####`.
   * Tính cả bản ghi đã xoá mềm để mã nhân viên không bao giờ bị tái sử dụng.
   */
  async findMaxEmployeeCodeNumber(): Promise<number> {
    const row = await this.repository
      .createQueryBuilder('employee')
      .withDeleted()
      .select(
        `MAX(CAST(SUBSTRING(employee.employee_code, ${EMPLOYEE_CODE_PREFIX.length + 1}) AS UNSIGNED))`,
        'maxNumber',
      )
      .where('employee.employee_code REGEXP :pattern', {
        pattern: `^${EMPLOYEE_CODE_PREFIX}[0-9]+$`,
      })
      .getRawOne<{ maxNumber: string | number | null }>();

    return row?.maxNumber ? Number(row.maxNumber) : 0;
  }

  countById(id: number): Promise<number> {
    return this.repository
      .createQueryBuilder('employee')
      .where('employee.id = :id', { id })
      .getCount();
  }

  countActiveDependents(employeeId: number): Promise<number> {
    return this.dependentRepository
      .createQueryBuilder('dependent')
      .where('dependent.employeeId = :employeeId', { employeeId })
      .andWhere('dependent.status = :status', {
        status: DependentStatus.ACTIVE,
      })
      .getCount();
  }

  /** Hợp đồng `active` mới nhất – nguồn số liệu lương của phiếu lương. */
  findActiveContract(employeeId: number): Promise<Contract | null> {
    return this.contractRepository
      .createQueryBuilder('contract')
      .where('contract.employeeId = :employeeId', { employeeId })
      .andWhere('contract.status = :status', { status: ContractStatus.ACTIVE })
      .orderBy('contract.startDate', 'DESC')
      .addOrderBy('contract.id', 'DESC')
      .getOne();
  }

  findDepartmentById(id: number): Promise<Department | null> {
    return this.departmentRepository
      .createQueryBuilder('department')
      .where('department.id = :id', { id })
      .getOne();
  }

  findPositionById(id: number): Promise<Position | null> {
    return this.positionRepository
      .createQueryBuilder('position')
      .where('position.id = :id', { id })
      .getOne();
  }

  /**
   * Phòng ban mà một nhân viên được quyền xem (role `manager`):
   * phòng ban của chính họ + mọi phòng ban họ đang làm trưởng phòng.
   */
  async findManagedDepartmentIds(employeeId: number): Promise<number[]> {
    const rows = await this.departmentRepository
      .createQueryBuilder('department')
      .select('department.id', 'id')
      .where('department.managerId = :employeeId', { employeeId })
      .getRawMany<{ id: string | number }>();

    return rows.map((row) => Number(row.id));
  }

  create(data: Partial<Employee>): Promise<Employee> {
    return this.repository.save(this.repository.create(data));
  }

  async update(id: number, data: Partial<Employee>): Promise<void> {
    await this.repository.update({ id }, data);
  }

  /** Xoá mềm: chỉ set `deleted_at` (schema §2.3 + architecture.md §16.4). */
  async softDelete(id: number): Promise<void> {
    await this.repository.softDelete({ id });
  }

  async restore(id: number): Promise<void> {
    await this.repository.restore({ id });
  }

  // ---------------------------------------------------------- thống kê ----

  /**
   * Lương cơ bản theo hợp đồng đang hiệu lực, cho các nhân viên trên MỘT trang.
   *
   * Một truy vấn cho cả trang (tối đa 100 dòng) thay vì join thẳng vào câu
   * list: một nhân viên có thể có nhiều hợp đồng nên join sẽ nhân đôi dòng và
   * làm sai `getManyAndCount()`.
   */
  async findActiveBaseSalaries(
    employeeIds: number[],
  ): Promise<EmployeeBaseSalary[]> {
    if (employeeIds.length === 0) {
      return [];
    }

    const rows = await this.contractRepository
      .createQueryBuilder('contract')
      .select('contract.employeeId', 'employeeId')
      .addSelect('MAX(contract.baseSalary)', 'baseSalary')
      .where('contract.employeeId IN (:...employeeIds)', { employeeIds })
      .andWhere('contract.status = :status', { status: ContractStatus.ACTIVE })
      .groupBy('contract.employeeId')
      .getRawMany<{
        employeeId: string | number;
        baseSalary: string | number;
      }>();

    return rows.map((row) => ({
      employeeId: Number(row.employeeId),
      baseSalary: Number(row.baseSalary),
    }));
  }

  countAll(departmentScope?: number[]): Promise<number> {
    return this.scoped(departmentScope).getCount();
  }

  async countByStatus(departmentScope?: number[]): Promise<StatusCount[]> {
    const rows = await this.scoped(departmentScope)
      .select('employee.status', 'status')
      .addSelect('COUNT(employee.id)', 'count')
      .groupBy('employee.status')
      .getRawMany<{ status: EmployeeStatus; count: string | number }>();

    return rows.map((row) => ({
      status: row.status,
      count: Number(row.count),
    }));
  }

  async countByGender(departmentScope?: number[]): Promise<GenderCount[]> {
    const rows = await this.scoped(departmentScope)
      .select('employee.gender', 'gender')
      .addSelect('COUNT(employee.id)', 'count')
      .groupBy('employee.gender')
      .getRawMany<{ gender: Gender; count: string | number }>();

    return rows.map((row) => ({
      gender: row.gender,
      count: Number(row.count),
    }));
  }

  /** Nhân viên vào làm trong `days` ngày gần đây. */
  countHiredWithinDays(
    days: number,
    departmentScope?: number[],
  ): Promise<number> {
    return this.scoped(departmentScope)
      .andWhere('employee.hireDate > DATE_SUB(CURDATE(), INTERVAL :days DAY)', {
        days,
      })
      .andWhere('employee.hireDate <= CURDATE()')
      .getCount();
  }

  /** Nhân viên sắp hết hạn thử việc trong `days` ngày tới. */
  countProbationEndingWithinDays(
    days: number,
    departmentScope?: number[],
  ): Promise<number> {
    return this.scoped(departmentScope)
      .andWhere('employee.probationEndDate IS NOT NULL')
      .andWhere('employee.probationEndDate >= CURDATE()')
      .andWhere(
        'employee.probationEndDate <= DATE_ADD(CURDATE(), INTERVAL :days DAY)',
        { days },
      )
      .getCount();
  }

  /** Hợp đồng `active` hết hạn trong `days` ngày tới. */
  countContractsExpiringWithinDays(
    days: number,
    departmentScope?: number[],
  ): Promise<number> {
    const query = this.contractRepository
      .createQueryBuilder('contract')
      .innerJoin('contract.employee', 'employee')
      .where('contract.status = :status', { status: ContractStatus.ACTIVE })
      .andWhere('contract.endDate IS NOT NULL')
      .andWhere('contract.endDate >= CURDATE()')
      .andWhere('contract.endDate <= DATE_ADD(CURDATE(), INTERVAL :days DAY)', {
        days,
      });

    this.applyScope(query, departmentScope);

    return query.getCount();
  }

  /**
   * Tuổi và thâm niên trung bình.
   *
   * Chia `DATEDIFF` cho 365.25 chứ không dùng `TIMESTAMPDIFF(YEAR, …)`:
   * TIMESTAMPDIFF cắt cụt về số năm tròn TRƯỚC khi lấy trung bình, nên một đội
   * toàn người 29 tuổi 11 tháng sẽ ra "29.0" thay vì gần 30.
   */
  async findAverages(departmentScope?: number[]): Promise<AverageStats> {
    const row = await this.scoped(departmentScope)
      .select('AVG(DATEDIFF(CURDATE(), employee.dateOfBirth) / 365.25)', 'age')
      .addSelect(
        'AVG(DATEDIFF(CURDATE(), employee.hireDate) / 365.25)',
        'tenure',
      )
      .getRawOne<{ age: string | null; tenure: string | null }>();

    return {
      averageAge:
        row?.age === null || row?.age === undefined ? null : Number(row.age),
      averageTenureYears:
        row?.tenure === null || row?.tenure === undefined
          ? null
          : Number(row.tenure),
    };
  }

  async countByDepartment(
    departmentScope?: number[],
  ): Promise<DepartmentHeadcount[]> {
    const rows = await this.scoped(departmentScope)
      .innerJoin('employee.department', 'department')
      .select('department.id', 'departmentId')
      .addSelect('department.name', 'departmentName')
      .addSelect('COUNT(employee.id)', 'count')
      .groupBy('department.id')
      .addGroupBy('department.name')
      .orderBy('count', 'DESC')
      .getRawMany<{
        departmentId: string | number;
        departmentName: string;
        count: string | number;
      }>();

    return rows.map((row) => ({
      departmentId: Number(row.departmentId),
      departmentName: row.departmentName,
      count: Number(row.count),
    }));
  }

  /**
   * Sinh nhật trong `days` ngày tới.
   *
   * `daysUntil` tính bằng cách dời ngày sinh tới lần kỷ niệm KẾ TIẾP: cộng đủ
   * số năm, cộng thêm 1 năm nữa nếu phần `MMDD` của ngày sinh đã qua so với
   * hôm nay. Cách này vượt mốc giao thừa đúng (sinh nhật 02/01 nhìn từ 28/12 ra
   * 5 ngày, không phải -360) và để MySQL tự xử lý 29/02 ở năm không nhuận.
   */
  async findUpcomingBirthdays(
    days: number,
    limit: number,
    departmentScope?: number[],
  ): Promise<BirthdayRow[]> {
    const nextBirthday =
      'DATE_ADD(employee.date_of_birth, INTERVAL (' +
      'YEAR(CURDATE()) - YEAR(employee.date_of_birth) + ' +
      "IF(DATE_FORMAT(employee.date_of_birth, '%m%d') < DATE_FORMAT(CURDATE(), '%m%d'), 1, 0)" +
      ') YEAR)';

    const rows = await this.scoped(departmentScope)
      .select('employee.id', 'employeeId')
      .addSelect('employee.employee_code', 'employeeCode')
      .addSelect('employee.full_name', 'fullName')
      .addSelect('employee.avatar_url', 'avatarUrl')
      .addSelect("DATE_FORMAT(employee.date_of_birth, '%m-%d')", 'birthday')
      .addSelect('DATEDIFF(' + nextBirthday + ', CURDATE())', 'daysUntil')
      .having('daysUntil <= :days', { days })
      .orderBy('daysUntil', 'ASC')
      .addOrderBy('employee.full_name', 'ASC')
      .limit(limit)
      .getRawMany<{
        employeeId: string | number;
        employeeCode: string;
        fullName: string;
        avatarUrl: string | null;
        birthday: string;
        daysUntil: string | number;
      }>();

    return rows.map((row) => ({
      employeeId: Number(row.employeeId),
      employeeCode: row.employeeCode,
      fullName: row.fullName,
      avatarUrl: row.avatarUrl,
      birthday: row.birthday,
      daysUntil: Number(row.daysUntil),
    }));
  }

  /** Query nhân viên "sống", đã áp phạm vi phòng ban của role hiện tại. */
  private scoped(departmentScope?: number[]): SelectQueryBuilder<Employee> {
    const query = this.repository.createQueryBuilder('employee');
    this.applyScope(query, departmentScope);
    return query;
  }

  /**
   * Giới hạn theo phòng ban. Mảng RỖNG nghĩa là không có phòng ban nào trong
   * phạm vi → `1 = 0` để trả rỗng; TUYỆT ĐỐI không rơi về "xem tất cả".
   */
  private applyScope(
    query: SelectQueryBuilder<Employee> | SelectQueryBuilder<Contract>,
    departmentScope?: number[],
  ): void {
    if (!departmentScope) {
      return;
    }

    if (departmentScope.length === 0) {
      query.andWhere('1 = 0');
      return;
    }

    query.andWhere('employee.departmentId IN (:...departmentScope)', {
      departmentScope,
    });
  }

  private baseQuery(): SelectQueryBuilder<Employee> {
    return this.repository
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.department', 'department')
      .leftJoinAndSelect('employee.position', 'position')
      .leftJoinAndSelect('employee.directManager', 'directManager');
  }
}
