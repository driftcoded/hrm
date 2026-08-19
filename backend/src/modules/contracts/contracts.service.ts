import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import {
  toDateOnlyString,
  toIsoString,
  todayDateString,
} from '@/common/utils/date.util';
import { resolvePagination } from '@/common/utils/pagination.util';
import { EmployeesService } from '@/modules/employees/employees.service';
import { ContractsRepository } from './contracts.repository';
import { ContractResponseDto } from './dto/contract-response.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { FilterContractDto } from './dto/filter-contract.dto';
import { TerminateContractDto } from './dto/terminate-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import {
  Contract,
  ContractStatus,
  ContractType,
} from './entities/contract.entity';

/**
 * Thời hạn tối đa của HĐ xác định thời hạn: 36 tháng (Điều 20.1.b BLLĐ 2019).
 */
export const MAX_FIXED_TERM_MONTHS = 36;

/**
 * Số lần được ký HĐ xác định thời hạn liên tiếp; lần thứ 3 buộc phải chuyển
 * sang không xác định thời hạn (Điều 20.2 BLLĐ 2019).
 */
export const MAX_FIXED_TERM_CONTRACTS = 2;

/**
 * Trần cứng của thời gian thử việc: 180 ngày cho người quản lý doanh nghiệp
 * (Điều 25 BLLĐ 2019).
 *
 * CỐ Ý không chặn ở mốc 60 ngày như database-schema.md §4.1 ghi: Điều 25 quy
 * định 4 mức (180 / 60 / 30 / 6 ngày) tuỳ vị trí công việc, mà bảng `contracts`
 * không lưu vị trí đó. Chặn cứng ở 60 sẽ từ chối hợp đồng thử việc HỢP PHÁP
 * của cấp quản lý. Ở đây chặn mức trần tuyệt đối; ràng buộc theo từng vị trí
 * thuộc quy trình duyệt của HR.
 */
export const MAX_PROBATION_DAYS = 180;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    private readonly contractsRepository: ContractsRepository,
    private readonly employeesService: EmployeesService,
  ) {}

  // ------------------------------------------------------------- đọc ----

  async findAll(
    filter: FilterContractDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<ContractResponseDto>> {
    const scope = await this.employeesService.resolveScope(user);
    const { page, limit, skip } = resolvePagination(filter);
    const search = filter.search?.trim();

    const [contracts, total] = await this.contractsRepository.findPaginated({
      skip,
      take: limit,
      sort: filter.sort ?? 'startDate',
      order: filter.order === 'asc' ? 'ASC' : 'DESC',
      employeeId:
        // Nhân viên thường chỉ thấy hợp đồng của chính mình, bất kể query gửi gì.
        scope.kind === 'self' ? scope.employeeId : filter.employeeId,
      status: filter.status,
      contractType: filter.contractType,
      search: search && search.length > 0 ? search : undefined,
      expiring: this.resolveExpiringRange(filter.expiringDays),
      departmentScope:
        scope.kind === 'department' ? scope.departmentIds : undefined,
    });

    return new PaginatedResponseDto(
      contracts.map((contract) => this.toResponse(contract)),
      total,
      page,
      limit,
    );
  }

  async findOne(
    id: number,
    user: AuthenticatedUser,
  ): Promise<ContractResponseDto> {
    const contract = await this.getExistingOrThrow(id);

    // Quyền xem hợp đồng = quyền xem hồ sơ của người ký nó.
    await this.employeesService.findOne(Number(contract.employeeId), user);

    return this.toResponse(contract);
  }

  // -------------------------------------------------------------- ghi ----

  async create(
    dto: CreateContractDto,
    createdBy: number | null,
  ): Promise<ContractResponseDto> {
    const contractNumber = dto.contractNumber.trim().toUpperCase();

    await this.assertEmployeeExists(dto.employeeId);
    await this.assertContractNumberAvailable(contractNumber);

    const status = dto.status ?? ContractStatus.DRAFT;
    this.assertCreatableStatus(status);
    this.assertDateRules(dto.contractType, dto.startDate, dto.endDate ?? null);
    this.assertSignDate(dto.signDate, dto.startDate);

    if (status === ContractStatus.ACTIVE) {
      await this.assertNoActiveContract(dto.employeeId);
    }

    if (dto.contractType === ContractType.FIXED_TERM) {
      await this.assertFixedTermQuota(dto.employeeId, status);
    }

    const created = await this.contractsRepository.create({
      employeeId: dto.employeeId,
      contractNumber,
      contractType: dto.contractType,
      startDate: dto.startDate,
      endDate: dto.endDate ?? null,
      signDate: dto.signDate,
      baseSalary: this.toDecimal(dto.baseSalary),
      insuranceSalary: this.toDecimal(dto.insuranceSalary),
      positionAllowance: this.toDecimal(dto.positionAllowance ?? 0),
      otherAllowance: this.toDecimal(dto.otherAllowance ?? 0),
      workingHours: this.toDecimal(dto.workingHours ?? 8),
      workingDays: dto.workingDays ?? 5,
      probationSalaryPct:
        dto.contractType === ContractType.PROBATION
          ? this.toDecimal(dto.probationSalaryPct ?? 85)
          : null,
      status,
      fileUrl: dto.fileUrl ?? null,
      note: dto.note ?? null,
      createdBy,
    });

    return this.toResponse(await this.getExistingOrThrow(Number(created.id)));
  }

  async update(
    id: number,
    dto: UpdateContractDto,
  ): Promise<ContractResponseDto> {
    const contract = await this.getExistingOrThrow(id);
    this.assertEditable(contract);

    const patch: Partial<Contract> = {};

    if (dto.contractNumber !== undefined) {
      const contractNumber = dto.contractNumber.trim().toUpperCase();
      if (contractNumber !== contract.contractNumber) {
        await this.assertContractNumberAvailable(contractNumber);
      }
      patch.contractNumber = contractNumber;
    }

    const contractType = dto.contractType ?? contract.contractType;
    const startDate = dto.startDate ?? contract.startDate;
    const endDate =
      dto.endDate !== undefined ? (dto.endDate ?? null) : contract.endDate;
    const signDate = dto.signDate ?? contract.signDate;
    const status = dto.status ?? contract.status;

    this.assertCreatableStatus(status);
    this.assertDateRules(contractType, startDate, endDate);
    this.assertSignDate(signDate, startDate);

    if (
      status === ContractStatus.ACTIVE &&
      contract.status !== ContractStatus.ACTIVE
    ) {
      await this.assertNoActiveContract(Number(contract.employeeId), id);
    }

    if (
      contractType === ContractType.FIXED_TERM &&
      status !== ContractStatus.DRAFT
    ) {
      await this.assertFixedTermQuota(Number(contract.employeeId), status, id);
    }

    patch.contractType = contractType;
    patch.startDate = startDate;
    patch.endDate = endDate;
    patch.signDate = signDate;
    patch.status = status;

    if (dto.baseSalary !== undefined) {
      patch.baseSalary = this.toDecimal(dto.baseSalary);
    }
    if (dto.insuranceSalary !== undefined) {
      patch.insuranceSalary = this.toDecimal(dto.insuranceSalary);
    }
    if (dto.positionAllowance !== undefined) {
      patch.positionAllowance = this.toDecimal(dto.positionAllowance);
    }
    if (dto.otherAllowance !== undefined) {
      patch.otherAllowance = this.toDecimal(dto.otherAllowance);
    }
    if (dto.workingHours !== undefined) {
      patch.workingHours = this.toDecimal(dto.workingHours);
    }
    if (dto.workingDays !== undefined) {
      patch.workingDays = dto.workingDays;
    }
    if (dto.probationSalaryPct !== undefined) {
      patch.probationSalaryPct =
        dto.probationSalaryPct === null
          ? null
          : this.toDecimal(dto.probationSalaryPct);
    }
    if (dto.fileUrl !== undefined) {
      patch.fileUrl = dto.fileUrl ?? null;
    }
    if (dto.note !== undefined) {
      patch.note = dto.note ?? null;
    }

    await this.contractsRepository.update(id, patch);

    return this.toResponse(await this.getExistingOrThrow(id));
  }

  /** `PATCH /contracts/:id/terminate` – chấm dứt hợp đồng trước hạn. */
  async terminate(
    id: number,
    dto: TerminateContractDto,
  ): Promise<ContractResponseDto> {
    const contract = await this.getExistingOrThrow(id);

    if (contract.status === ContractStatus.TERMINATED) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_ALREADY_TERMINATED',
        message: `Contract ${id} was already terminated on ${contract.terminatedDate ?? 'an earlier date'}`,
      });
    }

    if (contract.status === ContractStatus.DRAFT) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_NOT_SIGNED',
        message: `Contract ${id} is still a draft; delete it instead of terminating it`,
      });
    }

    if (
      toDateOnlyString(dto.terminatedDate) <
      toDateOnlyString(contract.startDate)
    ) {
      throw new UnprocessableEntityException({
        code: 'INVALID_DATE_RANGE',
        message: `terminatedDate ${dto.terminatedDate} is earlier than the contract start date ${toDateOnlyString(contract.startDate)}`,
      });
    }

    await this.contractsRepository.update(id, {
      status: ContractStatus.TERMINATED,
      terminatedDate: dto.terminatedDate,
      terminatedReason: dto.terminatedReason.trim(),
      ...(dto.note !== undefined ? { note: dto.note ?? null } : {}),
    });

    this.logger.log(
      `Hợp đồng ${contract.contractNumber} (id=${id}) đã chấm dứt ngày ${dto.terminatedDate}`,
    );

    return this.toResponse(await this.getExistingOrThrow(id));
  }

  /**
   * Xoá hợp đồng. Bảng `contracts` KHÔNG có cột `deleted_at` (schema §4.1)
   * nên đây là xoá vật lý — vì vậy CHỈ cho phép với bản nháp chưa ký.
   * Hợp đồng đã ký là chứng từ pháp lý: kết thúc nó bằng `/terminate`.
   */
  async remove(id: number): Promise<{ id: number; deleted: boolean }> {
    const contract = await this.getExistingOrThrow(id);

    if (contract.status !== ContractStatus.DRAFT) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_NOT_DELETABLE',
        message: `Only draft contracts can be deleted; contract ${id} has status "${contract.status}". Use PATCH /contracts/${id}/terminate instead.`,
      });
    }

    await this.contractsRepository.remove(id);

    return { id, deleted: true };
  }

  // -------------------------------------------------------- internals ----

  private async getExistingOrThrow(id: number): Promise<Contract> {
    const contract = await this.contractsRepository.findById(id);

    if (!contract) {
      throw new NotFoundException({
        code: 'CONTRACT_NOT_FOUND',
        message: `Cannot find contract with id ${id}`,
      });
    }

    return contract;
  }

  private async assertEmployeeExists(employeeId: number): Promise<void> {
    const employee =
      await this.contractsRepository.findEmployeeById(employeeId);

    if (!employee) {
      throw new UnprocessableEntityException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: `Cannot find employee with id ${employeeId} to attach the contract to`,
      });
    }
  }

  private async assertContractNumberAvailable(
    contractNumber: string,
  ): Promise<void> {
    const existing =
      await this.contractsRepository.findByContractNumber(contractNumber);

    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_CONTRACT_NUMBER',
        message: `Contract number "${contractNumber}" already exists (contract ${existing.id})`,
      });
    }
  }

  /** Chỉ `draft`/`active` được đặt trực tiếp; 2 trạng thái còn lại là kết quả. */
  private assertCreatableStatus(status: ContractStatus): void {
    if (status !== ContractStatus.DRAFT && status !== ContractStatus.ACTIVE) {
      throw new UnprocessableEntityException({
        code: 'INVALID_CONTRACT_STATUS',
        message: `status "${status}" cannot be set directly; "expired" happens on end_date and "terminated" via PATCH /contracts/:id/terminate`,
      });
    }
  }

  private async assertNoActiveContract(
    employeeId: number,
    excludeId?: number,
  ): Promise<void> {
    const active =
      await this.contractsRepository.findActiveByEmployee(employeeId);

    if (active && Number(active.id) !== excludeId) {
      throw new ConflictException({
        code: 'CONTRACT_ALREADY_ACTIVE',
        message: `Employee ${employeeId} already has an active contract (${active.contractNumber}); terminate it before activating a new one`,
      });
    }
  }

  /** Điều 20.2 BLLĐ 2019 – lần ký XĐTH thứ 3 phải là HĐ không xác định thời hạn. */
  private async assertFixedTermQuota(
    employeeId: number,
    status: ContractStatus,
    excludeId?: number,
  ): Promise<void> {
    if (status === ContractStatus.DRAFT) {
      return;
    }

    const signed = await this.contractsRepository.countSignedFixedTerm(
      employeeId,
      excludeId,
    );

    if (signed >= MAX_FIXED_TERM_CONTRACTS) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_TYPE_LIMIT',
        message: `Employee ${employeeId} already signed ${signed} fixed-term contracts (legal maximum ${MAX_FIXED_TERM_CONTRACTS}); the next one must be indefinite`,
      });
    }
  }

  /**
   * Ràng buộc ngày theo loại hợp đồng (schema §4.1 + BLLĐ 2019):
   *  - indefinite: KHÔNG có end_date
   *  - các loại khác: bắt buộc end_date, và end_date > start_date
   *  - fixed_term: tối đa 36 tháng
   *  - probation: tối đa 180 ngày (xem MAX_PROBATION_DAYS)
   */
  private assertDateRules(
    contractType: ContractType,
    startDate: string,
    endDate: string | null,
  ): void {
    const start = toDateOnlyString(startDate);
    const end = endDate === null ? null : toDateOnlyString(endDate);

    if (contractType === ContractType.INDEFINITE) {
      if (end !== null) {
        throw new UnprocessableEntityException({
          code: 'INVALID_CONTRACT_PERIOD',
          message:
            'An indefinite-term contract must not have an endDate (schema §4.1)',
        });
      }
      return;
    }

    if (end === null) {
      throw new UnprocessableEntityException({
        code: 'INVALID_CONTRACT_PERIOD',
        message: `A "${contractType}" contract requires an endDate`,
      });
    }

    if (end <= start) {
      throw new UnprocessableEntityException({
        code: 'INVALID_CONTRACT_PERIOD',
        message: `endDate ${end} must be after startDate ${start}`,
      });
    }

    if (contractType === ContractType.FIXED_TERM) {
      const limit = this.addMonths(start, MAX_FIXED_TERM_MONTHS);
      if (end > limit) {
        throw new UnprocessableEntityException({
          code: 'INVALID_CONTRACT_PERIOD',
          message: `A fixed-term contract must not exceed ${MAX_FIXED_TERM_MONTHS} months (Article 20.1.b, Labor Code 2019); latest allowed endDate is ${limit}`,
        });
      }
    }

    if (contractType === ContractType.PROBATION) {
      const days = this.daysBetween(start, end);
      if (days > MAX_PROBATION_DAYS) {
        throw new UnprocessableEntityException({
          code: 'INVALID_CONTRACT_PERIOD',
          message: `A probation contract must not exceed ${MAX_PROBATION_DAYS} days (Article 25, Labor Code 2019), got ${days}`,
        });
      }
    }
  }

  /** Ngày ký không được sau ngày hợp đồng bắt đầu có hiệu lực. */
  private assertSignDate(signDate: string, startDate: string): void {
    if (toDateOnlyString(signDate) > toDateOnlyString(startDate)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_SIGN_DATE',
        message: `signDate ${toDateOnlyString(signDate)} must not be after startDate ${toDateOnlyString(startDate)}`,
      });
    }
  }

  private assertEditable(contract: Contract): void {
    if (contract.status === ContractStatus.TERMINATED) {
      throw new UnprocessableEntityException({
        code: 'CONTRACT_ALREADY_TERMINATED',
        message: `Contract ${contract.id} was terminated and can no longer be edited`,
      });
    }
  }

  private resolveExpiringRange(
    expiringDays: number | undefined,
  ): { from: string; to: string } | undefined {
    if (expiringDays === undefined) {
      return undefined;
    }

    const from = todayDateString();

    return { from, to: this.addDays(from, expiringDays) };
  }

  private addDays(dateString: string, days: number): string {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day) + days * MS_PER_DAY);

    return date.toISOString().slice(0, 10);
  }

  private addMonths(dateString: string, months: number): string {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1 + months, day));

    return date.toISOString().slice(0, 10);
  }

  private daysBetween(from: string, to: string): number {
    const [fy, fm, fd] = from.split('-').map(Number);
    const [ty, tm, td] = to.split('-').map(Number);

    return Math.round(
      (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / MS_PER_DAY,
    );
  }

  /** Cột DECIMAL(15,2) của TypeORM nhận string để không mất độ chính xác. */
  private toDecimal(value: number): string {
    return value.toFixed(2);
  }

  private toResponse(contract: Contract): ContractResponseDto {
    return {
      id: Number(contract.id),
      employee: contract.employee
        ? {
            id: Number(contract.employee.id),
            employeeCode: contract.employee.employeeCode,
            fullName: contract.employee.fullName,
          }
        : null,
      contractNumber: contract.contractNumber,
      contractType: contract.contractType,
      startDate: toDateOnlyString(contract.startDate),
      endDate:
        contract.endDate === null ? null : toDateOnlyString(contract.endDate),
      signDate: toDateOnlyString(contract.signDate),
      baseSalary: Number(contract.baseSalary),
      insuranceSalary: Number(contract.insuranceSalary),
      positionAllowance: Number(contract.positionAllowance),
      otherAllowance: Number(contract.otherAllowance),
      workingHours: Number(contract.workingHours),
      workingDays: Number(contract.workingDays),
      probationSalaryPct:
        contract.probationSalaryPct === null
          ? null
          : Number(contract.probationSalaryPct),
      status: contract.status,
      terminatedDate:
        contract.terminatedDate === null
          ? null
          : toDateOnlyString(contract.terminatedDate),
      terminatedReason: contract.terminatedReason,
      fileUrl: contract.fileUrl,
      note: contract.note,
      createdAt: toIsoString(contract.createdAt),
      updatedAt: toIsoString(contract.updatedAt),
    };
  }
}
