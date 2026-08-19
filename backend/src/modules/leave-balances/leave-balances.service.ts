import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import {
  currentYearInVietnam,
  toDateOnlyString,
  toIsoString,
} from '@/common/utils/date.util';
import {
  annualLeaveDays,
  proratedFirstYearDays,
  seniorityYears,
} from '@/common/utils/leave.util';
import { resolvePagination } from '@/common/utils/pagination.util';
import { EmployeesRepository } from '@/modules/employees/employees.repository';
import { EmployeesService } from '@/modules/employees/employees.service';
import { LeaveTypesRepository } from '@/modules/leaves/leave-types.repository';
import { AdjustLeaveBalanceDto } from './dto/adjust-leave-balance.dto';
import { FilterLeaveBalanceDto } from './dto/filter-leave-balance.dto';
import { InitLeaveBalanceDto } from './dto/init-leave-balance.dto';
import {
  InitLeaveBalanceResultDto,
  LeaveBalanceResponseDto,
} from './dto/leave-balance-response.dto';
import { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveBalancesRepository } from './leave-balances.repository';

/** Mã loại nghỉ phép được cấp tự động theo Điều 113 — xem `leave-types.seed.ts`. */
export const ANNUAL_LEAVE_CODE = 'ANNUAL';

/**
 * Quỹ phép năm (PLAN 5.1, business-rules.md §8).
 *
 * CHỈ QUỸ PHÉP NĂM ĐƯỢC CẤP TỰ ĐỘNG. Điều 113 BLLĐ 2019 quy định số ngày phép
 * năm theo thâm niên, nên nó tính được. Các loại còn lại (ốm đau, thai sản,
 * cưới hỏi, tang chế) KHÔNG có quỹ cấp trước: chúng phát sinh theo sự việc và
 * số ngày do luật/nội quy quy định cho từng lần, cấp sẵn một quỹ đầu năm sẽ là
 * bịa ra một con số không có căn cứ.
 *
 * `remaining_days` là cột VIRTUAL của DB
 * (`allocated + carried_over − used − pending`). Không service nào ghi vào nó,
 * và cũng không nên: một con số suy ra được mà lưu riêng thì sớm muộn cũng lệch
 * với các thành phần của chính nó.
 *
 * `used_days` / `pending_days` do `LeaveRequestsService` cập nhật khi đơn đổi
 * trạng thái. Ở đây chỉ cấp và điều chỉnh `allocated_days` / `carried_over`.
 */
@Injectable()
export class LeaveBalancesService {
  private readonly logger = new Logger(LeaveBalancesService.name);

  constructor(
    private readonly leaveBalancesRepository: LeaveBalancesRepository,
    private readonly employeesRepository: EmployeesRepository,
    private readonly employeesService: EmployeesService,
    private readonly leaveTypesRepository: LeaveTypesRepository,
  ) {}

  // ------------------------------------------------------------ đọc ----

  async findAll(
    filter: FilterLeaveBalanceDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<LeaveBalanceResponseDto>> {
    const scope = await this.employeesService.resolveScope(user);

    if (scope.kind === 'self') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Role "${user.role}" cannot read leave balances`,
      });
    }

    const { page, limit, skip } = resolvePagination(filter);

    const [balances, total] = await this.leaveBalancesRepository.findPaginated({
      skip,
      take: limit,
      sort: filter.sort ?? 'year',
      order: filter.order === 'asc' ? 'ASC' : 'DESC',
      // Quỹ phép LUÔN thuộc về một năm; không có năm thì lấy năm hiện tại chứ
      // không trả về mọi năm chồng lên nhau.
      year: filter.year ?? currentYearInVietnam(),
      employeeId: filter.employeeId,
      departmentId: filter.departmentId,
      leaveTypeId: filter.leaveTypeId,
      departmentScope:
        scope.kind === 'department' ? scope.departmentIds : undefined,
    });

    return new PaginatedResponseDto(
      balances.map((balance) => this.toResponse(balance)),
      total,
      page,
      limit,
    );
  }

  // ------------------------------------------------------- khởi tạo ----

  /**
   * `POST /leave-balances/init` — cấp quỹ phép năm cho toàn bộ nhân viên đang
   * làm việc.
   *
   * KHÔNG GHI ĐÈ quỹ đã có. Chạy lại lần hai chỉ tạo cho những người còn thiếu.
   * Ghi đè sẽ xoá mất phần `carried_over` đã cộng và làm lệch quỹ của người đã
   * có đơn nghỉ được duyệt — số ngày đã dùng vẫn còn đó nhưng quỹ thì mới tinh.
   *
   * `dryRun` để chạy thử: đây là thao tác chạm vào cả công ty một lần, và người
   * bấm cần thấy trước nó sẽ tạo bao nhiêu, bỏ qua bao nhiêu.
   */
  async initYear(
    dto: InitLeaveBalanceDto,
    user: AuthenticatedUser,
  ): Promise<InitLeaveBalanceResultDto> {
    await this.assertCanManage(user);

    const leaveType =
      await this.leaveTypesRepository.findByCode(ANNUAL_LEAVE_CODE);

    if (!leaveType) {
      throw new UnprocessableEntityException({
        code: 'ANNUAL_LEAVE_TYPE_MISSING',
        message: `Leave type "${ANNUAL_LEAVE_CODE}" is not seeded; run the leave-types seed first`,
      });
    }

    const employees = await this.employeesRepository.findActiveForAllocation();
    const employeeIds = employees.map((employee) => Number(employee.id));

    const alreadyHave =
      await this.leaveBalancesRepository.findEmployeeIdsWithBalance(
        Number(leaveType.id),
        dto.year,
        employeeIds,
      );

    const carriedOverByEmployee = dto.carryOver
      ? await this.leaveBalancesRepository.findRemainingByEmployee(
          Number(leaveType.id),
          dto.year - 1,
          employeeIds,
        )
      : new Map<number, number>();

    // Mốc tính thâm niên là ngày ĐẦU NĂM được cấp, không phải hôm nay: chạy
    // khởi tạo tháng 1 hay tháng 3 phải ra cùng một con số.
    const asOf = `${dto.year}-01-01`;

    const toCreate: Partial<LeaveBalance>[] = [];

    for (const employee of employees) {
      const employeeId = Number(employee.id);

      if (alreadyHave.has(employeeId)) {
        continue;
      }

      const hireDate = toDateOnlyString(employee.hireDate);
      const fullYearDays = annualLeaveDays(seniorityYears(hireDate, asOf));

      toCreate.push({
        employeeId,
        leaveTypeId: Number(leaveType.id),
        year: dto.year,
        // Năm đầu tiên tính theo tỉ lệ tháng đã làm (§8.3); các năm sau đủ số.
        allocatedDays: proratedFirstYearDays(
          hireDate,
          dto.year,
          fullYearDays,
        ).toFixed(1),
        carriedOver: (carriedOverByEmployee.get(employeeId) ?? 0).toFixed(1),
        usedDays: '0.0',
        pendingDays: '0.0',
      });
    }

    if (!dto.dryRun && toCreate.length > 0) {
      await this.leaveBalancesRepository.createMany(toCreate);
    }

    this.logger.log(
      `Leave balance init ${dto.year}${dto.dryRun ? ' (dry run)' : ''} by user ${user.userId}: ${toCreate.length} created, ${alreadyHave.size} skipped`,
    );

    return {
      dryRun: dto.dryRun === true,
      year: dto.year,
      employeesConsidered: employees.length,
      created: toCreate.length,
      skipped: alreadyHave.size,
    };
  }

  // ------------------------------------------------------ điều chỉnh ----

  /**
   * `PATCH /leave-balances/:id` — nhân sự điều chỉnh quỹ phép.
   *
   * Chỉ sửa `allocated_days` và `carried_over`. `used_days`/`pending_days` là hệ
   * quả của các đơn nghỉ; sửa tay sẽ làm quỹ lệch khỏi danh sách đơn và không ai
   * biết bên nào đúng.
   *
   * KHÔNG cho hạ `allocated + carried_over` xuống dưới số đã dùng + đang chờ:
   * quỹ âm nghĩa là người đó đã nghỉ nhiều hơn số ngày họ có, mà việc đó phải
   * được xử lý bằng cách sửa đơn chứ không phải bằng một con số âm trong bảng.
   */
  async adjust(
    id: number,
    dto: AdjustLeaveBalanceDto,
    user: AuthenticatedUser,
  ): Promise<LeaveBalanceResponseDto> {
    await this.assertCanManage(user);

    const balance = await this.getExistingOrThrow(id);

    const allocated = dto.allocatedDays ?? Number(balance.allocatedDays);
    const carriedOver = dto.carriedOver ?? Number(balance.carriedOver);
    const committed = Number(balance.usedDays) + Number(balance.pendingDays);

    if (allocated + carriedOver < committed) {
      throw new UnprocessableEntityException({
        code: 'LEAVE_BALANCE_BELOW_COMMITTED',
        message: `Cannot set the balance to ${allocated + carriedOver} days: ${committed} are already used or pending`,
      });
    }

    balance.allocatedDays = allocated.toFixed(1);
    balance.carriedOver = carriedOver.toFixed(1);

    await this.leaveBalancesRepository.save(balance);

    this.logger.log(
      `Leave balance ${id} adjusted by user ${user.userId}: allocated=${allocated}, carriedOver=${carriedOver} — ${dto.reason.trim()}`,
    );

    return this.toResponse(await this.getExistingOrThrow(id));
  }

  // --------------------------------------------------------- nội bộ ----

  private async assertCanManage(user: AuthenticatedUser): Promise<void> {
    const scope = await this.employeesService.resolveScope(user);

    if (scope.kind !== 'all') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Role "${user.role}" cannot manage leave balances`,
      });
    }
  }

  private async getExistingOrThrow(id: number): Promise<LeaveBalance> {
    const balance = await this.leaveBalancesRepository.findById(id);

    if (!balance) {
      throw new NotFoundException({
        code: 'LEAVE_BALANCE_NOT_FOUND',
        message: `Leave balance ${id} not found`,
      });
    }

    return balance;
  }

  private toResponse(balance: LeaveBalance): LeaveBalanceResponseDto {
    const employee = balance.employee;
    const leaveType = balance.leaveType;

    return {
      id: Number(balance.id),
      employeeId: Number(balance.employeeId),
      employee: employee
        ? {
            id: Number(employee.id),
            employeeCode: employee.employeeCode,
            fullName: employee.fullName,
            departmentName: employee.department?.name ?? null,
          }
        : null,
      leaveType: leaveType
        ? {
            id: Number(leaveType.id),
            code: leaveType.code,
            name: leaveType.name,
          }
        : null,
      year: balance.year,
      allocatedDays: Number(balance.allocatedDays),
      carriedOver: Number(balance.carriedOver),
      usedDays: Number(balance.usedDays),
      pendingDays: Number(balance.pendingDays),
      remainingDays: Number(balance.remainingDays),
      updatedAt: toIsoString(balance.updatedAt),
    };
  }
}
