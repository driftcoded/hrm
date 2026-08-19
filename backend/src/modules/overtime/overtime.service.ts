import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  OVERTIME_LIMITS,
  STANDARD_WORK_HOURS_PER_DAY,
} from '@/common/constants/attendance.constant';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { toDateOnlyString, toIsoString } from '@/common/utils/date.util';
import {
  calculateOvertimeSpan,
  OvertimeRateType,
} from '@/common/utils/overtime.util';
import { resolvePagination } from '@/common/utils/pagination.util';
import { parseTimeToMinutes } from '@/common/utils/work-hours.util';
import { EmployeesService } from '@/modules/employees/employees.service';
import { HolidaysService } from '@/modules/system/holidays.service';
import { FilterOvertimeDto } from './dto/filter-overtime.dto';
import { CreateOvertimeDto } from './dto/create-overtime.dto';
import { OvertimeResponseDto } from './dto/overtime-response.dto';
import { RejectOvertimeDto } from './dto/reject-overtime.dto';
import {
  OvertimeRequest,
  OvertimeRequestStatus,
} from './entities/overtime-request.entity';
import { OvertimeRepository } from './overtime.repository';

const MINUTES_PER_DAY = 24 * 60;

/**
 * Đăng ký và duyệt làm thêm giờ (PLAN 4.1).
 *
 * ĐÂY LÀ CĂN CỨ DUY NHẤT ĐỂ TRẢ TIỀN LÀM THÊM. Điều 107 BLLĐ 2019 quy định làm
 * thêm giờ phải "được sự đồng ý của người lao động", nên nó là một thoả thuận
 * có đăng ký và có người duyệt. `attendances.overtime_hours` là số giờ đã ở lại
 * làm trên thực tế — hai con số đặt cạnh nhau để đối chiếu, không thay nhau.
 *
 * BA TRẦN CỦA ĐIỀU 107 ĐỀU ĐƯỢC KIỂM NGAY LÚC TẠO ĐƠN chứ không đợi tới lúc
 * duyệt: một đơn vượt trần mà vẫn nằm chờ trong danh sách là một cái bẫy — người
 * duyệt bấm đồng ý rồi mới biết công ty vừa vi phạm luật lao động.
 */
@Injectable()
export class OvertimeService {
  constructor(
    private readonly overtimeRepository: OvertimeRepository,
    private readonly employeesService: EmployeesService,
    private readonly holidaysService: HolidaysService,
  ) {}

  /** Tổng giờ làm thêm ĐÃ DUYỆT — `AttendancesService` gọi để dựng bảng tổng hợp tháng. */
  sumApprovedHours(
    employeeId: number,
    from: string,
    to: string,
  ): Promise<number> {
    return this.overtimeRepository.sumApprovedHours(employeeId, from, to);
  }

  // ---------------------------------------------------------- tạo đơn ----

  async create(
    user: AuthenticatedUser,
    dto: CreateOvertimeDto,
  ): Promise<OvertimeResponseDto> {
    const employeeId = this.requireOwnEmployeeId(user);
    const isHoliday = await this.isHoliday(dto.workDate);

    const span = calculateOvertimeSpan({
      workDate: dto.workDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      isHoliday,
    });

    await this.assertNoOverlap(employeeId, dto);
    await this.assertWithinLegalLimits(
      employeeId,
      dto.workDate,
      span.totalHours,
      span.rateType,
    );

    const saved = await this.overtimeRepository.create({
      employeeId,
      workDate: dto.workDate,
      startTime: normaliseTime(dto.startTime),
      endTime: normaliseTime(dto.endTime),
      totalHours: span.totalHours.toFixed(2),
      nightHours: span.nightHours.toFixed(2),
      rateType: span.rateType,
      rate: span.rate.toFixed(1),
      nightRateSurcharge: span.nightRateSurcharge.toFixed(1),
      reason: dto.reason.trim(),
      status: OvertimeRequestStatus.PENDING,
    });

    return this.toResponse(await this.getExistingOrThrow(Number(saved.id)));
  }

  // ------------------------------------------------------------ đọc ----

  async findAll(
    filter: FilterOvertimeDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<OvertimeResponseDto>> {
    const scope = await this.employeesService.resolveScope(user);
    const { page, limit, skip } = resolvePagination(filter);

    /*
     * Nhân viên thường KHÔNG bị chặn ở đây như bên `/attendances`: họ có quyền
     * xem danh sách đơn của CHÍNH MÌNH. Ghim cứng `employeeId` theo hồ sơ của
     * người gọi, bỏ qua `?employeeId=` họ gửi lên — nếu tin tham số đó thì bất
     * kỳ ai cũng đọc được đơn của người khác bằng cách đổi một con số trên URL.
     */
    const employeeId =
      scope.kind === 'self' ? scope.employeeId : filter.employeeId;

    const [requests, total] = await this.overtimeRepository.findPaginated({
      skip,
      take: limit,
      sort: filter.sort ?? 'workDate',
      order: filter.order === 'asc' ? 'ASC' : 'DESC',
      employeeId,
      departmentId: filter.departmentId,
      status: filter.status,
      dateRange: this.resolveDateRange(filter.month, filter.year),
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
  ): Promise<OvertimeResponseDto> {
    const request = await this.getExistingOrThrow(id);
    await this.assertCanRead(request, user);

    return this.toResponse(request);
  }

  // ----------------------------------------------------------- duyệt ----

  /**
   * Duyệt đơn (PLAN 4.1: "OT: manager duyệt → trạng thái `approved`").
   *
   * Kiểm lại trần Điều 107 MỘT LẦN NỮA tại đây, dù lúc tạo đã kiểm: giữa hai
   * thời điểm đó có thể có đơn khác của cùng người được duyệt, và trần là của
   * cả tháng chứ không của riêng một đơn. Bỏ bước này thì hai đơn mỗi đơn hợp
   * lệ vẫn cộng lại thành vi phạm.
   */
  async approve(
    id: number,
    user: AuthenticatedUser,
  ): Promise<OvertimeResponseDto> {
    const request = await this.getExistingOrThrow(id);
    const approverId = await this.assertCanApprove(request, user);

    this.assertPending(request);
    await this.assertWithinLegalLimits(
      Number(request.employeeId),
      toDateOnlyString(request.workDate),
      Number(request.totalHours),
      request.rateType,
      Number(request.id),
    );

    request.status = OvertimeRequestStatus.APPROVED;
    request.approvedBy = approverId;
    request.approvedAt = new Date();
    request.rejectedReason = null;

    await this.overtimeRepository.save(request);

    return this.toResponse(await this.getExistingOrThrow(id));
  }

  async reject(
    id: number,
    dto: RejectOvertimeDto,
    user: AuthenticatedUser,
  ): Promise<OvertimeResponseDto> {
    const request = await this.getExistingOrThrow(id);
    const approverId = await this.assertCanApprove(request, user);

    this.assertPending(request);

    request.status = OvertimeRequestStatus.REJECTED;
    request.approvedBy = approverId;
    request.approvedAt = new Date();
    request.rejectedReason = dto.reason.trim();

    await this.overtimeRepository.save(request);

    return this.toResponse(await this.getExistingOrThrow(id));
  }

  /**
   * Người nộp tự huỷ đơn của mình.
   *
   * Chỉ huỷ được đơn CÒN CHỜ. Đơn đã duyệt là một thoả thuận hai bên — rút lại
   * một mình thì phần công việc đã làm theo đơn đó biến mất khỏi hồ sơ. Muốn
   * huỷ đơn đã duyệt thì người duyệt phải từ chối, và việc đó có ghi lý do.
   */
  async cancel(
    id: number,
    user: AuthenticatedUser,
  ): Promise<OvertimeResponseDto> {
    const request = await this.getExistingOrThrow(id);
    const employeeId = this.requireOwnEmployeeId(user);

    if (Number(request.employeeId) !== employeeId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `User ${user.userId} cannot cancel an overtime request belonging to employee ${request.employeeId}`,
      });
    }

    this.assertPending(request);

    request.status = OvertimeRequestStatus.CANCELLED;
    await this.overtimeRepository.save(request);

    return this.toResponse(await this.getExistingOrThrow(id));
  }

  // ---------------------------------------------------- quy tắc luật ----

  private assertPending(request: OvertimeRequest): void {
    if (request.status !== OvertimeRequestStatus.PENDING) {
      throw new ConflictException({
        code: 'OVERTIME_NOT_PENDING',
        message: `Overtime request ${request.id} is "${request.status}", only pending requests can change state`,
      });
    }
  }

  /**
   * Hai ca làm thêm của cùng một người không được chồng giờ lên nhau.
   *
   * Không phải quy tắc hình thức: hai đơn chồng nhau nghĩa là cùng một giờ đồng
   * hồ được trả tiền hai lần.
   */
  private async assertNoOverlap(
    employeeId: number,
    dto: CreateOvertimeDto,
  ): Promise<void> {
    const existing = await this.overtimeRepository.findActiveByEmployeeAndDate(
      employeeId,
      dto.workDate,
    );

    const candidate = toSpan(dto.startTime, dto.endTime);

    for (const request of existing) {
      const other = toSpan(request.startTime, request.endTime);

      if (candidate.start < other.end && other.start < candidate.end) {
        throw new ConflictException({
          code: 'OVERLAPPING_OVERTIME',
          message: `Overtime ${dto.startTime}-${dto.endTime} on ${dto.workDate} overlaps request ${request.id} (${request.startTime}-${request.endTime})`,
        });
      }
    }
  }

  /**
   * Ba trần của Điều 107 BLLĐ 2019 (business-rules.md §7.2).
   *
   * `excludeRequestId` dùng khi DUYỆT một đơn đã nằm trong DB: không trừ nó ra
   * thì chính nó bị đếm hai lần và mọi đơn sát trần đều duyệt hỏng.
   */
  private async assertWithinLegalLimits(
    employeeId: number,
    workDate: string,
    hours: number,
    rateType: OvertimeRateType,
    excludeRequestId?: number,
  ): Promise<void> {
    const sumActive = async (from: string, to: string): Promise<number> => {
      const requests =
        await this.overtimeRepository.findActiveByEmployeeInRange(
          employeeId,
          from,
          to,
        );

      return requests
        .filter((request) => Number(request.id) !== excludeRequestId)
        .reduce((total, request) => total + Number(request.totalHours), 0);
    };

    /*
     * Trần NGÀY là tổng giờ CÓ MẶT, không phải riêng giờ làm thêm: "số giờ làm
     * việc bình thường và số giờ làm thêm không quá 12 giờ trong 01 ngày". Ngày
     * thường đã có 8 giờ chính nên chỉ còn 4 giờ làm thêm; ngày nghỉ và ngày lễ
     * không có ca chính nên được trọn 12 giờ.
     */
    const baseHours =
      rateType === OvertimeRateType.WEEKDAY ? STANDARD_WORK_HOURS_PER_DAY : 0;
    const dayTotal = baseHours + hours + (await sumActive(workDate, workDate));

    if (dayTotal > OVERTIME_LIMITS.MAX_TOTAL_HOURS_PER_DAY) {
      throw new UnprocessableEntityException({
        code: 'OVERTIME_DAILY_LIMIT_EXCEEDED',
        message: `Total hours on ${workDate} would be ${dayTotal}, over the ${OVERTIME_LIMITS.MAX_TOTAL_HOURS_PER_DAY}-hour daily cap (Article 107, Labour Code 2019)`,
      });
    }

    /*
     * Ngày cuối tháng phải tính thật, không được viết cứng `-31`: MySQL coi
     * '2026-02-31' là ngày không tồn tại nên `BETWEEN` không khớp dòng nào —
     * trần tháng 2 sẽ luôn "đạt" và mọi đơn tháng 2 đều lọt.
     */
    const month = workDate.slice(0, 7);
    const monthRange = this.monthRangeOf(workDate);
    const monthTotal =
      hours + (await sumActive(monthRange.from, monthRange.to));

    if (monthTotal > OVERTIME_LIMITS.MAX_HOURS_PER_MONTH) {
      throw new UnprocessableEntityException({
        code: 'OVERTIME_MONTHLY_LIMIT_EXCEEDED',
        message: `Overtime in ${month} would reach ${monthTotal}h, over the ${OVERTIME_LIMITS.MAX_HOURS_PER_MONTH}h monthly cap (Article 107, Labour Code 2019)`,
      });
    }

    const year = workDate.slice(0, 4);
    const yearTotal =
      hours + (await sumActive(`${year}-01-01`, `${year}-12-31`));

    if (yearTotal > OVERTIME_LIMITS.MAX_HOURS_PER_YEAR) {
      throw new UnprocessableEntityException({
        code: 'OVERTIME_YEARLY_LIMIT_EXCEEDED',
        message: `Overtime in ${year} would reach ${yearTotal}h, over the ${OVERTIME_LIMITS.MAX_HOURS_PER_YEAR}h yearly cap (Article 107, Labour Code 2019)`,
      });
    }
  }

  // --------------------------------------------------------- nội bộ ----

  private async isHoliday(workDate: string): Promise<boolean> {
    const holidays = await this.holidaysService.findByYear(
      Number(workDate.slice(0, 4)),
    );

    return holidays.some((holiday) => holiday.holidayDate === workDate);
  }

  private requireOwnEmployeeId(user: AuthenticatedUser): number {
    if (user.employeeId === null || user.employeeId === undefined) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `User ${user.userId} has no employee profile and cannot register overtime`,
      });
    }

    return Number(user.employeeId);
  }

  private async getExistingOrThrow(id: number): Promise<OvertimeRequest> {
    const request = await this.overtimeRepository.findById(id);

    if (!request) {
      throw new NotFoundException({
        code: 'OVERTIME_NOT_FOUND',
        message: `Overtime request ${id} not found`,
      });
    }

    return request;
  }

  private async assertCanRead(
    request: OvertimeRequest,
    user: AuthenticatedUser,
  ): Promise<void> {
    const scope = await this.employeesService.resolveScope(user);

    if (scope.kind === 'all') {
      return;
    }

    if (scope.kind === 'self') {
      if (Number(request.employeeId) !== scope.employeeId) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: `User ${user.userId} cannot read overtime request ${request.id}`,
        });
      }
      return;
    }

    const departmentId = request.employee?.departmentId;

    if (
      departmentId === undefined ||
      !scope.departmentIds.includes(Number(departmentId))
    ) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `User ${user.userId} cannot read overtime outside their departments`,
      });
    }
  }

  /**
   * Ai được duyệt: nhóm HR duyệt tất cả, `manager` duyệt người trong phòng mình.
   *
   * KHÔNG AI TỰ DUYỆT ĐƠN CỦA CHÍNH MÌNH, kể cả admin. Trưởng phòng cũng là nhân
   * viên và cũng đăng ký làm thêm; cho tự duyệt thì cả cơ chế phê duyệt chỉ còn
   * là một cái nút. Trả về `employees.id` của người duyệt để ghi vào `approved_by`.
   */
  private async assertCanApprove(
    request: OvertimeRequest,
    user: AuthenticatedUser,
  ): Promise<number> {
    const approverId = this.requireOwnEmployeeId(user);

    if (Number(request.employeeId) === approverId) {
      throw new ForbiddenException({
        code: 'CANNOT_APPROVE_OWN_OVERTIME',
        message: `Employee ${approverId} cannot approve or reject their own overtime request`,
      });
    }

    const scope = await this.employeesService.resolveScope(user);

    if (scope.kind === 'all') {
      return approverId;
    }

    if (scope.kind === 'department') {
      const departmentId = request.employee?.departmentId;

      if (
        departmentId !== undefined &&
        scope.departmentIds.includes(Number(departmentId))
      ) {
        return approverId;
      }
    }

    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: `Role "${user.role}" cannot approve overtime request ${request.id}`,
    });
  }

  private resolveDateRange(
    month?: number,
    year?: number,
  ): { from: string; to: string } | undefined {
    if (year === undefined) {
      return undefined;
    }

    if (month === undefined) {
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    }

    return monthRange(month, year);
  }

  /** Khoảng ngày của tháng chứa `workDate`. */
  private monthRangeOf(workDate: string): { from: string; to: string } {
    return monthRange(
      Number(workDate.slice(5, 7)),
      Number(workDate.slice(0, 4)),
    );
  }

  private toResponse(request: OvertimeRequest): OvertimeResponseDto {
    const employee = request.employee;
    const approver = request.approver;

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
      workDate: toDateOnlyString(request.workDate),
      startTime: shortTime(request.startTime),
      endTime: shortTime(request.endTime),
      totalHours: Number(request.totalHours),
      nightHours: Number(request.nightHours),
      rateType: request.rateType,
      rate: Number(request.rate),
      nightRateSurcharge: Number(request.nightRateSurcharge),
      reason: request.reason,
      status: request.status,
      approvedBy:
        request.approvedBy === null ? null : Number(request.approvedBy),
      approverName: approver?.fullName ?? null,
      approvedAt: request.approvedAt ? toIsoString(request.approvedAt) : null,
      rejectedReason: request.rejectedReason,
      createdAt: toIsoString(request.createdAt),
      updatedAt: toIsoString(request.updatedAt),
    };
  }
}

/** Khoảng giờ theo phút, đã mở rộng nếu ca vắt qua nửa đêm. */
function toSpan(
  startTime: string,
  endTime: string,
): { start: number; end: number } {
  const start = parseTimeToMinutes(startTime);
  const rawEnd = parseTimeToMinutes(endTime);

  return { start, end: rawEnd <= start ? rawEnd + MINUTES_PER_DAY : rawEnd };
}

/** Cột `TIME` của MySQL cần `HH:mm:ss`; DTO nhận `HH:mm`. */
function normaliseTime(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}

function shortTime(time: string): string {
  const minutes = parseTimeToMinutes(time);
  const pad = (value: number): string => `${value}`.padStart(2, '0');

  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/**
 * Khoảng ngày đầu–cuối của một tháng.
 *
 * Ngày 0 của tháng SAU chính là ngày cuối tháng này, nên không phải nhớ tháng
 * nào 30, tháng nào 31, và năm nhuận tự đúng.
 */
function monthRange(month: number, year: number): { from: string; to: string } {
  const pad = (value: number): string => `${value}`.padStart(2, '0');
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}
