import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  LEAVE_APPROVE_ROLES,
  LEAVE_RECORD_ROLES,
} from '@/common/constants/roles.constant';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { toDateOnlyString, toIsoString } from '@/common/utils/date.util';
import { countLeaveDays, workingDaysBetween } from '@/common/utils/leave.util';
import { resolvePagination } from '@/common/utils/pagination.util';
import {
  Attendance,
  AttendanceStatus,
} from '@/modules/attendances/entities/attendance.entity';
import { EmployeesService } from '@/modules/employees/employees.service';
import { LeaveBalance } from '@/modules/leave-balances/entities/leave-balance.entity';
import {
  LeaveHalf,
  LeaveRequest,
  LeaveRequestStatus,
} from '@/modules/leaves/entities/leave-request.entity';
import { LeaveTypesRepository } from '@/modules/leaves/leave-types.repository';
import { HolidaysService } from '@/modules/system/holidays.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { FilterLeaveRequestDto } from './dto/filter-leave-request.dto';
import {
  ApproveLeaveRequestResultDto,
  LeaveRequestResponseDto,
} from './dto/leave-request-response.dto';
import { RejectLeaveRequestDto } from './dto/reject-leave-request.dto';
import { LeaveRequestsRepository } from './leave-requests.repository';

/**
 * Đơn nghỉ phép (PLAN 5.1, business-rules.md §8).
 *
 * AI LÀM GÌ. Nhân viên không đăng nhập hệ thống này, nên không ai tự nộp đơn:
 *
 *   1. QUẢN LÝ ghi nhận đơn cho nhân viên phòng mình; nhân sự ghi cho bất kỳ ai.
 *      Người ghi lưu ở `recorded_by`, lấy từ token.
 *   2. NHÂN SỰ duyệt. `manager` ghi nhận nhưng KHÔNG duyệt, và người đã ghi một
 *      đơn không duyệt được chính đơn đó — cùng nguyên tắc với đơn làm thêm giờ.
 *
 * QUỸ PHÉP ĐỔI THEO TRẠNG THÁI ĐƠN, và mọi thay đổi chạy trong MỘT transaction
 * cùng với đơn:
 *
 *   | Thao tác  | pending_days | used_days |
 *   |-----------|--------------|-----------|
 *   | Ghi nhận  | + totalDays  | –         |
 *   | Duyệt     | − totalDays  | + totalDays |
 *   | Từ chối   | − totalDays  | –         |
 *   | Huỷ       | − totalDays  | –         |
 *
 * Ghi đơn mà không cập nhật quỹ (hoặc ngược lại) sẽ để lại một quỹ phép nói
 * khác với danh sách đơn, và không ai biết bên nào đúng. `remaining_days` là cột
 * VIRTUAL của DB nên tự đúng theo bốn cột trên.
 *
 * KHÔNG PHẢI LOẠI PHÉP NÀO CŨNG CÓ QUỸ. Có bản ghi `leave_balances` cho cặp
 * (nhân viên, loại phép, năm) thì mới trừ; không có thì đơn vẫn ghi được nhưng
 * không trừ gì. Ốm đau, thai sản, tang chế phát sinh theo sự việc và số ngày do
 * luật quy định cho từng lần, không có quỹ cấp trước để trừ.
 */
@Injectable()
export class LeaveRequestsService {
  private readonly logger = new Logger(LeaveRequestsService.name);

  constructor(
    private readonly leaveRequestsRepository: LeaveRequestsRepository,
    private readonly leaveTypesRepository: LeaveTypesRepository,
    private readonly employeesService: EmployeesService,
    private readonly holidaysService: HolidaysService,
    private readonly dataSource: DataSource,
  ) {}

  // ---------------------------------------------------------- ghi nhận ----

  async create(
    dto: CreateLeaveRequestDto,
    user: AuthenticatedUser,
  ): Promise<LeaveRequestResponseDto> {
    const recordedBy = await this.assertCanRecordFor(dto.employeeId, user);

    if (dto.endDate < dto.startDate) {
      throw new UnprocessableEntityException({
        code: 'INVALID_LEAVE_RANGE',
        message: `end date (${dto.endDate}) is before start date (${dto.startDate})`,
      });
    }

    /*
     * Quỹ phép là một con số CỦA MỘT NĂM. Kỳ nghỉ bắc qua giao thừa rút từ hai
     * quỹ khác nhau, và trừ hết vào một năm sẽ làm sai cả hai. Yêu cầu tách
     * thành hai đơn — rõ ràng hơn là âm thầm chia đôi theo một quy tắc mà người
     * dùng không nhìn thấy.
     */
    if (dto.startDate.slice(0, 4) !== dto.endDate.slice(0, 4)) {
      throw new UnprocessableEntityException({
        code: 'LEAVE_SPANS_TWO_YEARS',
        message:
          'A leave request cannot span two calendar years; split it into one request per year so each draws on its own balance',
      });
    }

    const leaveType = await this.leaveTypesRepository.findById(dto.leaveTypeId);

    if (!leaveType) {
      throw new NotFoundException({
        code: 'LEAVE_TYPE_NOT_FOUND',
        message: `Leave type ${dto.leaveTypeId} not found`,
      });
    }

    const holidays = await this.holidayDatesBetween(dto.startDate, dto.endDate);
    const totalDays = countLeaveDays({
      startDate: dto.startDate,
      endDate: dto.endDate,
      startHalf: dto.startHalf,
      endHalf: dto.endHalf,
      holidays,
    });

    /*
     * Kỳ nghỉ rơi trọn vào cuối tuần hoặc ngày lễ thì không có ngày phép nào bị
     * trừ — và một đơn trừ 0 ngày là một đơn không có nội dung. Báo lỗi để người
     * ghi biết mình chọn nhầm khoảng ngày, thay vì tạo ra một dòng vô nghĩa.
     */
    if (totalDays <= 0) {
      throw new UnprocessableEntityException({
        code: 'LEAVE_NO_WORKING_DAYS',
        message: `${dto.startDate}–${dto.endDate} contains no working day; nothing would be deducted`,
      });
    }

    this.assertWithinLeaveTypeLimits(leaveType, totalDays);
    await this.assertNoOverlap(dto.employeeId, dto.startDate, dto.endDate);

    const saved = await this.dataSource.transaction(async (manager) => {
      const request = await manager.save(
        manager.create(LeaveRequest, {
          employeeId: dto.employeeId,
          leaveTypeId: dto.leaveTypeId,
          startDate: dto.startDate,
          endDate: dto.endDate,
          startHalf: dto.startHalf ?? LeaveHalf.FULL,
          endHalf: dto.endHalf ?? LeaveHalf.FULL,
          totalDays: totalDays.toFixed(1),
          reason: dto.reason.trim(),
          recordedBy,
          status: LeaveRequestStatus.PENDING,
        }),
      );

      // Giữ chỗ ngay khi ghi nhận: hai đơn nộp gần nhau không được cùng tiêu
      // một quỹ mà cả hai đều thấy còn đủ.
      await this.moveBalance(manager, request, { pending: totalDays });

      return request;
    });

    return this.toResponse(await this.getExistingOrThrow(Number(saved.id)));
  }

  // ------------------------------------------------------------ đọc ----

  async findAll(
    filter: FilterLeaveRequestDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<LeaveRequestResponseDto>> {
    const scope = await this.employeesService.resolveScope(user);

    if (scope.kind === 'self') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Role "${user.role}" cannot list leave requests`,
      });
    }

    const { page, limit, skip } = resolvePagination(filter);

    const [requests, total] = await this.leaveRequestsRepository.findPaginated({
      skip,
      take: limit,
      sort: filter.sort ?? 'startDate',
      order: filter.order === 'asc' ? 'ASC' : 'DESC',
      employeeId: filter.employeeId,
      departmentId: filter.departmentId,
      leaveTypeId: filter.leaveTypeId,
      status: filter.status,
      overlapping:
        filter.from && filter.to
          ? { from: filter.from, to: filter.to }
          : undefined,
      departmentScope:
        scope.kind === 'department' ? scope.departmentIds : undefined,
    });

    return new PaginatedResponseDto(
      requests.map((request) => this.toResponse(request)),
      total,
      page,
      limit,
    );
  }

  async findOne(
    id: number,
    user: AuthenticatedUser,
  ): Promise<LeaveRequestResponseDto> {
    const request = await this.getExistingOrThrow(id);
    await this.assertCanRead(request, user);

    return this.toResponse(request);
  }

  /**
   * `GET /leave-requests/calendar` — ai đang nghỉ trong khoảng ngày.
   *
   * Chỉ trả đơn ĐÃ DUYỆT: lịch này dùng để biết hôm đó ai vắng mặt, và một đơn
   * còn chờ duyệt chưa cho phép ai nghỉ cả.
   */
  async calendar(
    from: string,
    to: string,
    user: AuthenticatedUser,
  ): Promise<LeaveRequestResponseDto[]> {
    const scope = await this.employeesService.resolveScope(user);

    if (scope.kind === 'self') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Role "${user.role}" cannot read the leave calendar`,
      });
    }

    const requests = await this.leaveRequestsRepository.findApprovedInRange(
      from,
      to,
      scope.kind === 'department' ? scope.departmentIds : undefined,
    );

    return requests.map((request) => this.toResponse(request));
  }

  // ----------------------------------------------------------- duyệt ----

  /**
   * Duyệt đơn: chuyển `pending_days` sang `used_days`, và ghi những ngày nghỉ
   * vào bảng chấm công với trạng thái `leave`.
   *
   * KHÔNG GHI ĐÈ ngày đã có dữ liệu chấm công. Một người vừa có giờ chấm công
   * vừa được duyệt nghỉ phép trong cùng ngày là mâu thuẫn cần người xem, không
   * phải thứ để phần mềm tự quyết. Những ngày đó được trả về ở
   * `attendanceConflicts`.
   */
  async approve(
    id: number,
    user: AuthenticatedUser,
  ): Promise<ApproveLeaveRequestResultDto> {
    const request = await this.getExistingOrThrow(id);
    const approverId = this.assertCanApprove(request, user);

    this.assertPending(request);

    const totalDays = Number(request.totalDays);
    const holidays = await this.holidayDatesBetween(
      toDateOnlyString(request.startDate),
      toDateOnlyString(request.endDate),
    );
    const leaveDates = workingDaysBetween(
      toDateOnlyString(request.startDate),
      toDateOnlyString(request.endDate),
      holidays,
    );

    const conflicts = await this.dataSource.transaction(async (manager) => {
      request.status = LeaveRequestStatus.APPROVED;
      request.approvedBy = approverId;
      request.approvedAt = new Date();
      request.rejectedReason = null;
      await manager.save(request);

      await this.moveBalance(manager, request, {
        pending: -totalDays,
        used: totalDays,
      });

      return this.writeAttendanceDays(manager, request, leaveDates);
    });

    return {
      request: this.toResponse(await this.getExistingOrThrow(id)),
      attendanceDaysWritten: leaveDates.length - conflicts.length,
      attendanceConflicts: conflicts,
    };
  }

  async reject(
    id: number,
    dto: RejectLeaveRequestDto,
    user: AuthenticatedUser,
  ): Promise<LeaveRequestResponseDto> {
    const request = await this.getExistingOrThrow(id);
    const approverId = this.assertCanApprove(request, user);

    this.assertPending(request);

    await this.dataSource.transaction(async (manager) => {
      request.status = LeaveRequestStatus.REJECTED;
      request.approvedBy = approverId;
      request.approvedAt = new Date();
      request.rejectedReason = dto.reason.trim();
      await manager.save(request);

      // Trả lại chỗ đã giữ. Quên bước này thì quỹ phép của người bị từ chối cứ
      // hụt dần đi sau mỗi lần nộp lại.
      await this.moveBalance(manager, request, {
        pending: -Number(request.totalDays),
      });
    });

    return this.toResponse(await this.getExistingOrThrow(id));
  }

  /**
   * Rút lại đơn.
   *
   * Chỉ đơn CÒN CHỜ. Đơn đã duyệt là một ngày nghỉ đã được cho phép và đã ghi
   * vào bảng chấm công — gỡ nó lặng lẽ thì bảng công còn dòng `leave` mà không
   * còn đơn nào giải thích. Muốn bỏ đơn đã duyệt thì người duyệt phải từ chối.
   */
  async cancel(
    id: number,
    user: AuthenticatedUser,
  ): Promise<LeaveRequestResponseDto> {
    const request = await this.getExistingOrThrow(id);
    const scope = await this.employeesService.resolveScope(user);
    const actorId = this.employeeIdOf(user);

    const isRecorder =
      request.recordedBy !== null && Number(request.recordedBy) === actorId;

    if (scope.kind !== 'all' && !isRecorder) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `User ${user.userId} did not record leave request ${id} and cannot cancel it`,
      });
    }

    this.assertPending(request);

    await this.dataSource.transaction(async (manager) => {
      request.status = LeaveRequestStatus.CANCELLED;
      await manager.save(request);

      await this.moveBalance(manager, request, {
        pending: -Number(request.totalDays),
      });
    });

    return this.toResponse(await this.getExistingOrThrow(id));
  }

  // ------------------------------------------------------- quỹ phép ----

  /**
   * Cộng/trừ `pending_days` và `used_days` của quỹ phép tương ứng.
   *
   * KHÔNG CÓ QUỸ THÌ KHÔNG LÀM GÌ, và đó là hành vi đúng: ốm đau, thai sản,
   * tang chế không có quỹ cấp trước để trừ. Tạo quỹ ngầm ở đây sẽ đẻ ra những
   * bản ghi `allocated_days = 0` mà không ai cấp.
   *
   * Khoá dòng quỹ bằng `SELECT ... FOR UPDATE` (pessimistic write): hai đơn
   * duyệt cùng lúc mà đọc–sửa–ghi tuần tự sẽ ghi đè lẫn nhau và một trong hai
   * lần trừ biến mất.
   */
  private async moveBalance(
    manager: EntityManager,
    request: LeaveRequest,
    delta: { pending?: number; used?: number },
  ): Promise<void> {
    const year = Number(toDateOnlyString(request.startDate).slice(0, 4));

    const balance = await manager.findOne(LeaveBalance, {
      where: {
        employeeId: Number(request.employeeId),
        leaveTypeId: Number(request.leaveTypeId),
        year,
      },
      lock: { mode: 'pessimistic_write' },
    });

    if (!balance) {
      return;
    }

    const pending = Number(balance.pendingDays) + (delta.pending ?? 0);
    const used = Number(balance.usedDays) + (delta.used ?? 0);

    if (delta.pending !== undefined && delta.pending > 0) {
      const remaining =
        Number(balance.allocatedDays) +
        Number(balance.carriedOver) -
        Number(balance.usedDays) -
        Number(balance.pendingDays);

      if (delta.pending > remaining) {
        throw new UnprocessableEntityException({
          code: 'INSUFFICIENT_LEAVE_BALANCE',
          message: `Employee ${request.employeeId} has ${remaining} day(s) left for ${year} but the request asks for ${delta.pending}`,
        });
      }
    }

    // Không cho về số âm: một quỹ âm là dấu hiệu của lỗi cộng trừ ở đâu đó, và
    // để nó lọt xuống DB thì mọi con số sau đó đều sai theo.
    balance.pendingDays = Math.max(0, pending).toFixed(1);
    balance.usedDays = Math.max(0, used).toFixed(1);

    await manager.save(balance);
  }

  /**
   * Ghi những ngày nghỉ đã duyệt vào bảng chấm công (`status = leave`).
   *
   * Đây là thứ khiến `absentDays` của bảng công không tính người nghỉ phép là
   * vắng mặt — xem `AttendancesService`. Trả về những ngày ĐÃ CÓ dữ liệu nên
   * không ghi được.
   */
  private async writeAttendanceDays(
    manager: EntityManager,
    request: LeaveRequest,
    dates: string[],
  ): Promise<string[]> {
    const conflicts: string[] = [];

    for (const workDate of dates) {
      const existing = await manager.findOne(Attendance, {
        where: { employeeId: Number(request.employeeId), workDate },
      });

      if (existing) {
        conflicts.push(workDate);
        continue;
      }

      await manager.save(
        manager.create(Attendance, {
          employeeId: Number(request.employeeId),
          workDate,
          checkIn: null,
          checkOut: null,
          breakStart: null,
          breakEnd: null,
          workHours: null,
          overtimeHours: '0.00',
          isLate: false,
          lateMinutes: 0,
          isEarlyLeave: false,
          earlyLeaveMinutes: 0,
          status: AttendanceStatus.LEAVE,
          leaveRequestId: Number(request.id),
          note: null,
        }),
      );
    }

    if (conflicts.length > 0) {
      this.logger.warn(
        `Leave request ${request.id}: ${conflicts.length} day(s) already had attendance data and were left untouched (${conflicts.join(', ')})`,
      );
    }

    return conflicts;
  }

  // ---------------------------------------------------- quy tắc khác ----

  private assertPending(request: LeaveRequest): void {
    if (request.status !== LeaveRequestStatus.PENDING) {
      throw new ConflictException({
        code: 'LEAVE_NOT_PENDING',
        message: `Leave request ${request.id} is "${request.status}", only pending requests can change state`,
      });
    }
  }

  /** Giới hạn của từng loại phép (`min_days`, `max_consecutive`). */
  private assertWithinLeaveTypeLimits(
    leaveType: { minDays: string; maxConsecutive: number | null; name: string },
    totalDays: number,
  ): void {
    const minDays = Number(leaveType.minDays);

    if (minDays > 0 && totalDays < minDays) {
      throw new UnprocessableEntityException({
        code: 'LEAVE_BELOW_MINIMUM',
        message: `"${leaveType.name}" requires at least ${minDays} day(s); this request is ${totalDays}`,
      });
    }

    if (
      leaveType.maxConsecutive !== null &&
      totalDays > leaveType.maxConsecutive
    ) {
      throw new UnprocessableEntityException({
        code: 'LEAVE_ABOVE_MAX_CONSECUTIVE',
        message: `"${leaveType.name}" allows at most ${leaveType.maxConsecutive} consecutive day(s); this request is ${totalDays}`,
      });
    }
  }

  /**
   * Một người không nghỉ hai lần cùng một ngày.
   *
   * Không phải quy tắc hình thức: hai đơn chồng ngày sẽ trừ quỹ phép hai lần cho
   * cùng một ngày vắng mặt.
   */
  private async assertNoOverlap(
    employeeId: number,
    startDate: string,
    endDate: string,
  ): Promise<void> {
    const existing = await this.leaveRequestsRepository.findActiveOverlapping(
      employeeId,
      startDate,
      endDate,
    );

    if (existing.length > 0) {
      const clash = existing[0];

      throw new ConflictException({
        code: 'OVERLAPPING_LEAVE',
        message: `${startDate}–${endDate} overlaps leave request ${clash.id} (${toDateOnlyString(clash.startDate)}–${toDateOnlyString(clash.endDate)})`,
      });
    }
  }

  private async holidayDatesBetween(
    from: string,
    to: string,
  ): Promise<Set<string>> {
    const years = new Set([Number(from.slice(0, 4)), Number(to.slice(0, 4))]);
    const dates = new Set<string>();

    for (const year of years) {
      const holidays = await this.holidaysService.findByYear(year);

      for (const holiday of holidays) {
        dates.add(holiday.holidayDate);
      }
    }

    return dates;
  }

  // --------------------------------------------------------- nội bộ ----

  /**
   * `employees.id` của người đang thao tác, hoặc `null`.
   *
   * `null` là hợp lệ: tài khoản `admin` được seed sẵn không gắn với hồ sơ nhân
   * viên nào. Họ vẫn ghi và duyệt được; cột `recorded_by`/`approved_by` khi đó
   * ghi `null`, đọc đúng là "không gắn được với hồ sơ nào".
   */
  private employeeIdOf(user: AuthenticatedUser): number | null {
    return user.employeeId === null || user.employeeId === undefined
      ? null
      : Number(user.employeeId);
  }

  private async getExistingOrThrow(id: number): Promise<LeaveRequest> {
    const request = await this.leaveRequestsRepository.findById(id);

    if (!request) {
      throw new NotFoundException({
        code: 'LEAVE_NOT_FOUND',
        message: `Leave request ${id} not found`,
      });
    }

    return request;
  }

  /** Ai được GHI NHẬN đơn nghỉ cho nhân viên nào. */
  private async assertCanRecordFor(
    employeeId: number,
    user: AuthenticatedUser,
  ): Promise<number | null> {
    if (!LEAVE_RECORD_ROLES.includes(user.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Role "${user.role}" cannot record leave; requires one of roles: ${LEAVE_RECORD_ROLES.join(', ')}`,
      });
    }

    // Ném EMPLOYEE_NOT_FOUND / FORBIDDEN theo đúng phạm vi của người gọi.
    await this.employeesService.findOne(employeeId, user);

    return this.employeeIdOf(user);
  }

  /**
   * Ai được DUYỆT — hai điều kiện, cả hai đều cần:
   *
   *   1. Vai trò thuộc `LEAVE_APPROVE_ROLES` (nhân sự). `manager` ghi nhận
   *      nhưng không duyệt.
   *   2. Không phải người đã GHI NHẬN chính đơn này.
   *
   * Đơn cũ có `recorded_by` là `null` thì bỏ qua điều kiện 2 — không biết ai
   * nhập, và chặn tất cả sẽ khiến dữ liệu cũ kẹt vĩnh viễn ở trạng thái chờ.
   */
  private assertCanApprove(
    request: LeaveRequest,
    user: AuthenticatedUser,
  ): number | null {
    if (!LEAVE_APPROVE_ROLES.includes(user.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Role "${user.role}" cannot approve leave; requires one of roles: ${LEAVE_APPROVE_ROLES.join(', ')}`,
      });
    }

    const approverId = this.employeeIdOf(user);

    if (
      request.recordedBy !== null &&
      approverId !== null &&
      Number(request.recordedBy) === approverId
    ) {
      throw new ForbiddenException({
        code: 'CANNOT_APPROVE_OWN_RECORD',
        message: `Employee ${approverId} recorded leave request ${request.id} and cannot also approve it`,
      });
    }

    return approverId;
  }

  private async assertCanRead(
    request: LeaveRequest,
    user: AuthenticatedUser,
  ): Promise<void> {
    const scope = await this.employeesService.resolveScope(user);

    if (scope.kind === 'all') {
      return;
    }

    if (scope.kind === 'self') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `User ${user.userId} cannot read leave request ${request.id}`,
      });
    }

    const departmentId = request.employee?.departmentId;

    if (
      departmentId === undefined ||
      !scope.departmentIds.includes(Number(departmentId))
    ) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `User ${user.userId} cannot read leave outside their departments`,
      });
    }
  }

  private toResponse(request: LeaveRequest): LeaveRequestResponseDto {
    const employee = request.employee;
    const leaveType = request.leaveType;

    return {
      id: Number(request.id),
      employeeId: Number(request.employeeId),
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
            isPaid: leaveType.isPaid,
          }
        : null,
      startDate: toDateOnlyString(request.startDate),
      endDate: toDateOnlyString(request.endDate),
      startHalf: request.startHalf,
      endHalf: request.endHalf,
      totalDays: Number(request.totalDays),
      reason: request.reason,
      recordedBy:
        request.recordedBy === null ? null : Number(request.recordedBy),
      recorderName: request.recorder?.fullName ?? null,
      status: request.status,
      approvedBy:
        request.approvedBy === null ? null : Number(request.approvedBy),
      approverName: request.approver?.fullName ?? null,
      approvedAt: request.approvedAt ? toIsoString(request.approvedAt) : null,
      rejectedReason: request.rejectedReason,
      attachmentUrl: request.attachmentUrl,
      createdAt: toIsoString(request.createdAt),
      updatedAt: toIsoString(request.updatedAt),
    };
  }
}
