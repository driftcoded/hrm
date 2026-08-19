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
  DeleteLeaveRequestResultDto,
  LeaveRequestResponseDto,
  UpdateLeaveRequestResultDto,
} from './dto/leave-request-response.dto';
import { RejectLeaveRequestDto } from './dto/reject-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
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

    const totalDays = await this.validateAndCountDays({
      employeeId: dto.employeeId,
      leaveTypeId: dto.leaveTypeId,
      startDate: dto.startDate,
      endDate: dto.endDate,
      startHalf: dto.startHalf,
      endHalf: dto.endHalf,
    });

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

  /**
   * Sửa một đơn CÒN HIỆU LỰC — `pending` hoặc `approved`.
   *
   * SỬA ĐƠN ĐÃ DUYỆT KÉO THEO HAI THỨ, và cả hai đi cùng một transaction với
   * đơn:
   *
   *   1. Quỹ phép: đơn chờ giữ chỗ ở `pending_days`, đơn đã duyệt đã tiêu vào
   *      `used_days`. Trả về đúng cột nó đang chiếm, rồi lấy lại cũng ở cột đó.
   *   2. Bảng chấm công: đơn đã duyệt đã ghi những ngày `leave` ra bảng công.
   *      Đổi khoảng ngày mà không ghi lại thì bảng công còn nguyên kỳ nghỉ cũ.
   *
   * TRẢ CHỖ CŨ TRƯỚC RỒI MỚI GIỮ CHỖ MỚI. Giữ trước trả sau sẽ làm một đơn 3
   * ngày sửa thành 4 ngày bị từ chối oan khi quỹ chỉ còn đúng 3 — vì trong
   * khoảnh khắc đó nó đang chiếm 7.
   *
   * Đơn `rejected` / `cancelled` KHÔNG sửa được: nó không giữ ngày nào và không
   * có dòng chấm công nào: sửa ngày trên một đơn đã bị từ chối chỉ khiến lý do
   * từ chối nói về một kỳ nghỉ chưa từng tồn tại. Cần lại thì ghi đơn mới.
   */
  async update(
    id: number,
    dto: UpdateLeaveRequestDto,
    user: AuthenticatedUser,
  ): Promise<UpdateLeaveRequestResultDto> {
    const request = await this.getExistingOrThrow(id);
    const wasApproved = request.status === LeaveRequestStatus.APPROVED;

    if (wasApproved) {
      /*
       * Sửa đơn đã duyệt là viết lại một quyết định đã ra, kèm dời ngày công đã
       * ghi. Cùng ranh giới với việc xoá đơn đã duyệt: quản lý ghi nhận không
       * làm, dù là đơn chính mình nhập.
       */
      if (!LEAVE_APPROVE_ROLES.includes(user.role)) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: `Role "${user.role}" cannot edit an approved leave request; requires one of roles: ${LEAVE_APPROVE_ROLES.join(', ')}`,
        });
      }
    } else {
      await this.assertCanAmend(request, user);
      this.assertActive(request);
    }

    const next = {
      leaveTypeId: dto.leaveTypeId ?? Number(request.leaveTypeId),
      startDate: dto.startDate ?? toDateOnlyString(request.startDate),
      endDate: dto.endDate ?? toDateOnlyString(request.endDate),
      startHalf: dto.startHalf ?? request.startHalf,
      endHalf: dto.endHalf ?? request.endHalf,
    };

    const totalDays = await this.validateAndCountDays({
      ...next,
      employeeId: Number(request.employeeId),
      excludeId: Number(request.id),
    });

    const previousTotal = Number(request.totalDays);
    let attendanceDaysWritten = 0;
    let attendanceConflicts: string[] = [];
    let attendanceDaysKept = 0;

    await this.dataSource.transaction(async (manager) => {
      // Đọc quỹ CŨ khi đơn còn nguyên loại phép và năm cũ — đổi hai thứ đó là
      // đổi sang một dòng quỹ khác, trả nhầm chỗ thì cả hai quỹ cùng sai.
      await this.moveBalance(
        manager,
        request,
        wasApproved ? { used: -previousTotal } : { pending: -previousTotal },
      );

      // Gỡ ngày công của kỳ nghỉ CŨ trước khi đơn mang ngày mới, để còn tìm
      // được chúng theo `leave_request_id`.
      if (wasApproved) {
        attendanceDaysKept = (await this.removeAttendanceDays(manager, request))
          .kept;
      }

      request.leaveTypeId = next.leaveTypeId;
      request.startDate = next.startDate;
      request.endDate = next.endDate;
      request.startHalf = next.startHalf;
      request.endHalf = next.endHalf;
      request.totalDays = totalDays.toFixed(1);

      if (dto.reason !== undefined) {
        request.reason = dto.reason.trim();
      }

      await manager.save(request);

      await this.moveBalance(
        manager,
        request,
        wasApproved ? { used: totalDays } : { pending: totalDays },
      );

      if (wasApproved) {
        const holidays = await this.holidayDatesBetween(
          next.startDate,
          next.endDate,
        );
        const leaveDates = workingDaysBetween(
          next.startDate,
          next.endDate,
          holidays,
        );

        attendanceConflicts = await this.writeAttendanceDays(
          manager,
          request,
          leaveDates,
        );
        attendanceDaysWritten = leaveDates.length - attendanceConflicts.length;
      }
    });

    this.logger.log(
      `Leave request ${id} ("${request.status}") edited by user ${user.userId}: ${previousTotal} -> ${totalDays} day(s)`,
    );

    return {
      request: this.toResponse(await this.getExistingOrThrow(id)),
      attendanceDaysWritten,
      attendanceConflicts,
      attendanceDaysKept,
    };
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

    await this.assertCanAmend(request, user);
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

  /**
   * Xoá hẳn một đơn khỏi danh sách.
   *
   * XOÁ PHẢI GỠ SẠCH DẤU VẾT ĐƠN ĐÃ ĐỂ LẠI, nếu không nó để lại rác ở hai chỗ:
   *
   *   - Quỹ phép: đơn `pending` đang giữ chỗ, đơn `approved` đã tiêu. Không hoàn
   *     lại thì quỹ của nhân viên hụt vĩnh viễn mà không còn đơn nào giải thích.
   *   - Bảng chấm công: FK là `ON DELETE SET NULL`, nên xoá đơn suông sẽ để lại
   *     những dòng `leave` mồ côi — người xem bảng công thấy nhân viên nghỉ phép
   *     mà không tra ra được theo đơn nào.
   *
   * Dòng chấm công ĐÃ BỊ SỬA sang trạng thái khác thì GIỮ LẠI: nó không còn là
   * hệ quả của đơn này nữa mà là dữ liệu công thật, nhập tay hoặc nạp từ máy
   * chấm công. Số dòng giữ lại trả về cho người xoá biết.
   */
  async remove(
    id: number,
    user: AuthenticatedUser,
  ): Promise<DeleteLeaveRequestResultDto> {
    const request = await this.getExistingOrThrow(id);

    if (request.status === LeaveRequestStatus.PENDING) {
      await this.assertCanAmend(request, user);
    } else if (!LEAVE_APPROVE_ROLES.includes(user.role)) {
      /*
       * Đơn đã qua tay người duyệt — xoá nó là đảo ngược một quyết định của
       * nhân sự, kèm theo hoàn lại quỹ phép. Quản lý ghi nhận không làm việc đó.
       */
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Role "${user.role}" cannot delete a "${request.status}" leave request; requires one of roles: ${LEAVE_APPROVE_ROLES.join(', ')}`,
      });
    }

    let attendanceDaysRemoved = 0;
    let attendanceDaysKept = 0;

    await this.dataSource.transaction(async (manager) => {
      if (request.status === LeaveRequestStatus.PENDING) {
        await this.moveBalance(manager, request, {
          pending: -Number(request.totalDays),
        });
      } else if (request.status === LeaveRequestStatus.APPROVED) {
        await this.moveBalance(manager, request, {
          used: -Number(request.totalDays),
        });

        const attendance = await this.removeAttendanceDays(manager, request);
        attendanceDaysRemoved = attendance.removed;
        attendanceDaysKept = attendance.kept;
      }
      // `rejected` / `cancelled`: quỹ đã được trả lại lúc chuyển trạng thái, và
      // hai trạng thái đó chưa bao giờ ghi vào bảng chấm công.

      await manager.delete(LeaveRequest, { id: Number(request.id) });
    });

    this.logger.log(
      `Leave request ${id} ("${request.status}", ${request.totalDays} day(s)) deleted by user ${user.userId}`,
    );

    return {
      id,
      deleted: true,
      attendanceDaysRemoved,
      attendanceDaysKept,
    };
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

    /*
     * Chặn theo TỔNG hai cột, không riêng `pending`. Duyệt đơn chuyển
     * pending → used (tổng bằng 0) nên không vướng; còn sửa một đơn ĐÃ DUYỆT
     * cho dài thêm thì chỉ chạm vào `used`, và nếu chỉ soi `pending` thì nó đi
     * lọt và đẩy `remaining_days` xuống số âm.
     */
    const claimed = (delta.pending ?? 0) + (delta.used ?? 0);

    if (claimed > 0) {
      const remaining =
        Number(balance.allocatedDays) +
        Number(balance.carriedOver) -
        Number(balance.usedDays) -
        Number(balance.pendingDays);

      if (claimed > remaining) {
        throw new UnprocessableEntityException({
          code: 'INSUFFICIENT_LEAVE_BALANCE',
          message: `Employee ${request.employeeId} has ${remaining} day(s) left for ${year} but the request asks for ${claimed}`,
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

  /**
   * Gỡ những ngày `leave` mà lúc duyệt đơn này đã ghi vào bảng chấm công.
   *
   * Chỉ gỡ dòng CÒN NGUYÊN trạng thái `leave`. Một dòng mang `leave_request_id`
   * của đơn này nhưng trạng thái đã khác nghĩa là sau đó có người nhập tay hoặc
   * nạp dữ liệu từ máy chấm công đè lên — đó là ngày công thật, xoá đi là mất
   * dữ liệu không lấy lại được. Giữ lại và báo số lượng ra ngoài.
   */
  private async removeAttendanceDays(
    manager: EntityManager,
    request: LeaveRequest,
  ): Promise<{ removed: number; kept: number }> {
    const rows = await manager.find(Attendance, {
      where: { leaveRequestId: Number(request.id) },
    });

    const untouched = rows.filter(
      (row) => row.status === AttendanceStatus.LEAVE,
    );
    const kept = rows.length - untouched.length;

    if (untouched.length > 0) {
      await manager.delete(
        Attendance,
        untouched.map((row) => Number(row.id)),
      );
    }

    if (kept > 0) {
      this.logger.warn(
        `Leave request ${request.id}: ${kept} attendance row(s) had been changed away from "leave" and were kept`,
      );
    }

    return { removed: untouched.length, kept };
  }

  // ---------------------------------------------------- quy tắc khác ----

  /**
   * Ai được SỬA / RÚT LẠI / XOÁ một đơn còn chờ duyệt.
   *
   * Người ghi đơn sửa được đơn của mình; nhân sự (phạm vi `all`) sửa được của
   * bất kỳ ai. Quản lý phòng khác không đụng vào đơn không phải mình nhập, kể cả
   * khi nhân viên đó nằm trong phạm vi họ đọc được.
   */
  private async assertCanAmend(
    request: LeaveRequest,
    user: AuthenticatedUser,
  ): Promise<void> {
    const scope = await this.employeesService.resolveScope(user);
    const actorId = this.employeeIdOf(user);

    const isRecorder =
      request.recordedBy !== null && Number(request.recordedBy) === actorId;

    if (scope.kind !== 'all' && !isRecorder) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `User ${user.userId} did not record leave request ${request.id} and cannot change it`,
      });
    }
  }

  /**
   * Kiểm tra một kỳ nghỉ và trả về số ngày phép nó tiêu.
   *
   * Ghi nhận và sửa đơn phải chạy CÙNG một bộ quy tắc. Để hai đường tự kiểm tra
   * lấy thì sớm muộn cũng lệch nhau một điều kiện, và cái lệch đó là một đơn sửa
   * xong lọt qua được thứ mà lúc ghi nhận đã bị chặn.
   *
   * `excludeId` chỉ dùng khi sửa: một đơn luôn giao ngày với chính nó.
   */
  private async validateAndCountDays(input: {
    employeeId: number;
    leaveTypeId: number;
    startDate: string;
    endDate: string;
    startHalf?: LeaveHalf;
    endHalf?: LeaveHalf;
    excludeId?: number;
  }): Promise<number> {
    if (input.endDate < input.startDate) {
      throw new UnprocessableEntityException({
        code: 'INVALID_LEAVE_RANGE',
        message: `end date (${input.endDate}) is before start date (${input.startDate})`,
      });
    }

    /*
     * Quỹ phép là một con số CỦA MỘT NĂM. Kỳ nghỉ bắc qua giao thừa rút từ hai
     * quỹ khác nhau, và trừ hết vào một năm sẽ làm sai cả hai. Yêu cầu tách
     * thành hai đơn — rõ ràng hơn là âm thầm chia đôi theo một quy tắc mà người
     * dùng không nhìn thấy.
     */
    if (input.startDate.slice(0, 4) !== input.endDate.slice(0, 4)) {
      throw new UnprocessableEntityException({
        code: 'LEAVE_SPANS_TWO_YEARS',
        message:
          'A leave request cannot span two calendar years; split it into one request per year so each draws on its own balance',
      });
    }

    const leaveType = await this.leaveTypesRepository.findById(
      input.leaveTypeId,
    );

    if (!leaveType) {
      throw new NotFoundException({
        code: 'LEAVE_TYPE_NOT_FOUND',
        message: `Leave type ${input.leaveTypeId} not found`,
      });
    }

    const holidays = await this.holidayDatesBetween(
      input.startDate,
      input.endDate,
    );
    const totalDays = countLeaveDays({
      startDate: input.startDate,
      endDate: input.endDate,
      startHalf: input.startHalf,
      endHalf: input.endHalf,
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
        message: `${input.startDate}–${input.endDate} contains no working day; nothing would be deducted`,
      });
    }

    this.assertWithinLeaveTypeLimits(leaveType, totalDays);
    await this.assertNoOverlap(
      input.employeeId,
      input.startDate,
      input.endDate,
      input.excludeId,
    );

    return totalDays;
  }

  /**
   * Đơn CÒN HIỆU LỰC: `pending` hoặc `approved` — hai trạng thái còn chiếm ngày
   * trên quỹ phép. `rejected`/`cancelled` đã trả hết và đã đóng.
   */
  private assertActive(request: LeaveRequest): void {
    if (
      request.status !== LeaveRequestStatus.PENDING &&
      request.status !== LeaveRequestStatus.APPROVED
    ) {
      throw new ConflictException({
        code: 'LEAVE_NOT_ACTIVE',
        message: `Leave request ${request.id} is "${request.status}" and is closed; record a new request instead`,
      });
    }
  }

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
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.leaveRequestsRepository.findActiveOverlapping(
      employeeId,
      startDate,
      endDate,
      excludeId,
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
