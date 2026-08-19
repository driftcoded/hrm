import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ADVANCE_APPROVE_ROLES,
  ADVANCE_RECORD_ROLES,
} from '@/common/constants/roles.constant';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { toDateOnlyString, toIsoString } from '@/common/utils/date.util';
import { resolvePagination } from '@/common/utils/pagination.util';
import { EmployeesService } from '@/modules/employees/employees.service';
import { CreateSalaryAdvanceDto } from './dto/create-salary-advance.dto';
import { FilterSalaryAdvanceDto } from './dto/filter-salary-advance.dto';
import { RejectSalaryAdvanceDto } from './dto/reject-salary-advance.dto';
import { SalaryAdvanceResponseDto } from './dto/salary-advance-response.dto';
import {
  SalaryAdvance,
  SalaryAdvanceStatus,
} from './entities/salary-advance.entity';

/**
 * Tạm ứng lương (PLAN 6.1).
 *
 * CÙNG KHUÔN VỚI ĐƠN NGHỈ PHÉP, vì cùng một lý do: nhân viên không đăng nhập hệ
 * thống này nên không ai tự đề nghị. Quản lý ghi nhận cho phòng mình, nhân sự
 * ghi cho bất kỳ ai, và người ĐÃ GHI không duyệt được chính phiếu đó — tạm ứng
 * là tiền mặt ra khỏi công ty, nên bước duyệt phải có người thứ hai.
 *
 * PHIẾU ĐÃ BỊ TRỪ VÀO BẢNG LƯƠNG (`deducted`) KHÔNG SỬA ĐƯỢC NỮA. Nó đã thành
 * một dòng trên bảng lương của ai đó; đổi số tiền ở đây sẽ làm bảng lương nói
 * khác với chứng từ mà không có gì cảnh báo.
 */
@Injectable()
export class SalaryAdvancesService {
  private readonly logger = new Logger(SalaryAdvancesService.name);

  constructor(
    @InjectRepository(SalaryAdvance)
    private readonly repository: Repository<SalaryAdvance>,
    private readonly employeesService: EmployeesService,
  ) {}

  async create(
    dto: CreateSalaryAdvanceDto,
    user: AuthenticatedUser,
  ): Promise<SalaryAdvanceResponseDto> {
    if (!ADVANCE_RECORD_ROLES.includes(user.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Role "${user.role}" cannot record a salary advance; requires one of roles: ${ADVANCE_RECORD_ROLES.join(', ')}`,
      });
    }

    // Ném EMPLOYEE_NOT_FOUND / FORBIDDEN theo đúng phạm vi của người gọi.
    await this.employeesService.findOne(dto.employeeId, user);

    const saved = await this.repository.save(
      this.repository.create({
        employeeId: dto.employeeId,
        amount: dto.amount.toFixed(2),
        advanceDate: dto.advanceDate,
        deductMonth: dto.deductMonth,
        deductYear: dto.deductYear,
        reason: dto.reason.trim(),
        status: SalaryAdvanceStatus.PENDING,
        recordedBy: this.employeeIdOf(user),
      }),
    );

    return this.toResponse(await this.getExistingOrThrow(Number(saved.id)));
  }

  async findAll(
    filter: FilterSalaryAdvanceDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<SalaryAdvanceResponseDto>> {
    if (!ADVANCE_RECORD_ROLES.includes(user.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Role "${user.role}" cannot read salary advances`,
      });
    }

    const { page, limit, skip } = resolvePagination(filter);
    const scope = await this.employeesService.resolveScope(user);

    const query = this.repository
      .createQueryBuilder('advance')
      .innerJoinAndSelect('advance.employee', 'employee')
      .leftJoinAndSelect('employee.department', 'department')
      .leftJoinAndSelect('advance.recorder', 'recorder')
      .leftJoinAndSelect('advance.approver', 'approver')
      .orderBy('advance.advanceDate', 'DESC')
      .addOrderBy('advance.id', 'DESC')
      .skip(skip)
      .take(limit);

    if (filter.employeeId !== undefined) {
      query.andWhere('advance.employeeId = :employeeId', {
        employeeId: filter.employeeId,
      });
    }

    if (filter.status !== undefined) {
      query.andWhere('advance.status = :status', { status: filter.status });
    }

    if (filter.deductYear !== undefined) {
      query.andWhere('advance.deductYear = :deductYear', {
        deductYear: filter.deductYear,
      });
    }

    if (filter.deductMonth !== undefined) {
      query.andWhere('advance.deductMonth = :deductMonth', {
        deductMonth: filter.deductMonth,
      });
    }

    // `manager` chỉ thấy phòng mình quản; nhân sự thấy tất cả.
    if (scope.kind === 'department') {
      if (scope.departmentIds.length === 0) {
        query.andWhere('1 = 0');
      } else {
        query.andWhere('employee.departmentId IN (:...departmentScope)', {
          departmentScope: scope.departmentIds,
        });
      }
    }

    const [advances, total] = await query.getManyAndCount();

    return new PaginatedResponseDto(
      advances.map((advance) => this.toResponse(advance)),
      total,
      page,
      limit,
    );
  }

  async approve(
    id: number,
    user: AuthenticatedUser,
  ): Promise<SalaryAdvanceResponseDto> {
    const advance = await this.getExistingOrThrow(id);
    const approverId = this.assertCanApprove(advance, user);

    this.assertPending(advance);

    advance.status = SalaryAdvanceStatus.APPROVED;
    advance.approvedBy = approverId;
    advance.approvedAt = new Date();
    advance.rejectedReason = null;

    await this.repository.save(advance);

    this.logger.log(
      `Salary advance ${id} (${advance.amount}) approved by user ${user.userId}`,
    );

    return this.toResponse(await this.getExistingOrThrow(id));
  }

  async reject(
    id: number,
    dto: RejectSalaryAdvanceDto,
    user: AuthenticatedUser,
  ): Promise<SalaryAdvanceResponseDto> {
    const advance = await this.getExistingOrThrow(id);
    const approverId = this.assertCanApprove(advance, user);

    this.assertPending(advance);

    advance.status = SalaryAdvanceStatus.REJECTED;
    advance.approvedBy = approverId;
    advance.approvedAt = new Date();
    advance.rejectedReason = dto.reason.trim();

    await this.repository.save(advance);

    return this.toResponse(await this.getExistingOrThrow(id));
  }

  /** Rút lại phiếu vừa ghi. Chỉ khi còn chờ duyệt. */
  async cancel(
    id: number,
    user: AuthenticatedUser,
  ): Promise<SalaryAdvanceResponseDto> {
    const advance = await this.getExistingOrThrow(id);
    const scope = await this.employeesService.resolveScope(user);
    const actorId = this.employeeIdOf(user);

    const isRecorder =
      advance.recordedBy !== null && Number(advance.recordedBy) === actorId;

    if (scope.kind !== 'all' && !isRecorder) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `User ${user.userId} did not record salary advance ${id} and cannot cancel it`,
      });
    }

    this.assertPending(advance);

    advance.status = SalaryAdvanceStatus.CANCELLED;
    await this.repository.save(advance);

    return this.toResponse(await this.getExistingOrThrow(id));
  }

  // --------------------------------------------------------- nội bộ ----

  private assertPending(advance: SalaryAdvance): void {
    if (advance.status !== SalaryAdvanceStatus.PENDING) {
      throw new ConflictException({
        code: 'ADVANCE_NOT_PENDING',
        message: `Salary advance ${advance.id} is "${advance.status}", only a pending one can change state`,
      });
    }
  }

  /**
   * Ai được DUYỆT — hai điều kiện, cả hai đều cần: vai trò thuộc
   * `ADVANCE_APPROVE_ROLES`, và không phải người đã GHI chính phiếu này.
   *
   * Phiếu cũ có `recorded_by` là `null` thì bỏ qua điều kiện hai — không biết ai
   * nhập, và chặn tất cả sẽ khiến dữ liệu cũ kẹt vĩnh viễn ở trạng thái chờ.
   */
  private assertCanApprove(
    advance: SalaryAdvance,
    user: AuthenticatedUser,
  ): number | null {
    if (!ADVANCE_APPROVE_ROLES.includes(user.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Role "${user.role}" cannot approve a salary advance; requires one of roles: ${ADVANCE_APPROVE_ROLES.join(', ')}`,
      });
    }

    const actorId = this.employeeIdOf(user);

    if (
      advance.recordedBy !== null &&
      actorId !== null &&
      Number(advance.recordedBy) === actorId
    ) {
      throw new ForbiddenException({
        code: 'CANNOT_APPROVE_OWN_RECORD',
        message: `User ${user.userId} recorded salary advance ${advance.id} and cannot approve it`,
      });
    }

    return actorId;
  }

  private employeeIdOf(user: AuthenticatedUser): number | null {
    return user.employeeId === null || user.employeeId === undefined
      ? null
      : Number(user.employeeId);
  }

  private async getExistingOrThrow(id: number): Promise<SalaryAdvance> {
    const advance = await this.repository.findOne({
      where: { id },
      relations: {
        employee: { department: true },
        recorder: true,
        approver: true,
      },
    });

    if (!advance) {
      throw new NotFoundException({
        code: 'ADVANCE_NOT_FOUND',
        message: `Salary advance ${id} not found`,
      });
    }

    return advance;
  }

  private toResponse(advance: SalaryAdvance): SalaryAdvanceResponseDto {
    return {
      id: Number(advance.id),
      employeeId: Number(advance.employeeId),
      employee: {
        id: Number(advance.employee?.id ?? advance.employeeId),
        employeeCode: advance.employee?.employeeCode ?? '',
        fullName: advance.employee?.fullName ?? '',
        departmentName: advance.employee?.department?.name ?? null,
      },
      amount: Number(advance.amount),
      deductedAmount: Number(advance.deductedAmount),
      advanceDate: toDateOnlyString(advance.advanceDate),
      deductMonth: advance.deductMonth,
      deductYear: advance.deductYear,
      reason: advance.reason,
      status: advance.status,
      rejectedReason: advance.rejectedReason,
      recordedBy:
        advance.recordedBy === null ? null : Number(advance.recordedBy),
      recorderName: advance.recorder?.fullName ?? null,
      approverName: advance.approver?.fullName ?? null,
      approvedAt: advance.approvedAt ? toIsoString(advance.approvedAt) : null,
      createdAt: toIsoString(advance.createdAt),
    };
  }
}
