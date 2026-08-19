import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import {
  toDateOnlyString,
  toIsoString,
  vietnamDateTime,
} from '@/common/utils/date.util';
import { resolvePagination } from '@/common/utils/pagination.util';
import {
  calculateWorkHours,
  formatMinutesToTime,
  parseTimeToMinutes,
} from '@/common/utils/work-hours.util';
import { EmployeesService } from '@/modules/employees/employees.service';
import { HolidaysService } from '@/modules/system/holidays.service';
import { OvertimeService } from '@/modules/overtime/overtime.service';
import { AttendancesRepository } from './attendances.repository';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import {
  AttendanceResponseDto,
  AttendanceSummaryDto,
  MyAttendanceResponseDto,
} from './dto/attendance-response.dto';
import { FilterAttendanceDto } from './dto/filter-attendance.dto';
import { MonthQueryDto } from './dto/month-query.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { Attendance, AttendanceStatus } from './entities/attendance.entity';

/**
 * Nghiệp vụ chấm công (PLAN 4.1, api-spec.md §7, business-rules.md §12).
 *
 * BA NGUYÊN TẮC CHI PHỐI CẢ FILE:
 *
 * 1. GIỜ DO SERVER ĐỌC, KHÔNG DO CLIENT GỬI. `checkIn`/`checkOut` không nhận
 *    tham số thời gian. Nhận giờ từ client là để nhân viên tự khai giờ vào.
 *    Muốn sửa giờ thì đi qua `update()` — có phân quyền HR và bắt buộc ghi lý do.
 *
 * 2. THỜI GIAN LÀ GIỜ VIỆT NAM, không phải giờ server (`vietnamDateTime`).
 *
 * 3. `attendances.overtime_hours` KHÔNG PHẢI CĂN CỨ TRẢ TIỀN. Nó là số giờ đã
 *    ở lại làm, suy ra từ giờ chấm. Tiền làm thêm trả theo đơn đã duyệt ở
 *    `OvertimeService` — Điều 107 BLLĐ 2019 đòi làm thêm giờ phải có thoả
 *    thuận. Bản tổng hợp tháng trả về CẢ HAI con số, đặt cạnh nhau để HR đối
 *    chiếu chứ không để ai nhầm cái này thành cái kia.
 */
@Injectable()
export class AttendancesService {
  constructor(
    private readonly attendancesRepository: AttendancesRepository,
    private readonly employeesService: EmployeesService,
    private readonly holidaysService: HolidaysService,
    private readonly overtimeService: OvertimeService,
  ) {}

  // ------------------------------------------------------- chấm công ----

  /**
   * Chấm công vào cho CHÍNH người đang đăng nhập.
   *
   * Chấm lần thứ hai trong ngày trả 409 chứ không ghi đè: PLAN 4.1 quy định
   * "check-in 2 lần trong ngày → chỉ tính lần đầu". Ghi đè sẽ cho phép một
   * người đến muộn chấm lại lúc về để xoá dấu vết đi muộn.
   */
  async checkIn(
    user: AuthenticatedUser,
    dto: CheckInDto,
  ): Promise<AttendanceResponseDto> {
    const employeeId = this.requireOwnEmployeeId(user);
    const { date, time } = vietnamDateTime();

    const existing = await this.attendancesRepository.findByEmployeeAndDate(
      employeeId,
      date,
    );

    if (existing?.checkIn) {
      throw new ConflictException({
        code: 'ALREADY_CHECKED_IN',
        message: `Employee ${employeeId} already checked in at ${existing.checkIn} on ${date}`,
      });
    }

    const isLate = this.isLateArrival(time);

    /*
     * Bản ghi có thể đã tồn tại mà chưa có giờ vào (HR tạo trước, hoặc ngày lễ
     * đã được đánh dấu sẵn) — khi đó cập nhật chứ không tạo mới, nếu không sẽ
     * đụng UNIQUE (employee_id, work_date).
     */
    const record = existing ?? newAttendance();
    record.employeeId = employeeId;
    record.workDate = date;
    record.checkIn = time;
    record.isLate = isLate;
    record.lateMinutes = this.minutesLate(time);
    record.status = isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
    record.note = dto.note?.trim() || record.note || null;

    const saved = existing
      ? await this.attendancesRepository.save(record)
      : await this.attendancesRepository.create(record);

    return this.toResponse(saved);
  }

  /**
   * Chấm công ra và tính giờ công.
   *
   * Chưa chấm vào thì KHÔNG tự suy ra giờ vào từ giờ chuẩn — trả 404
   * NOT_CHECKED_IN. Đoán hộ giờ vào là bịa ra một dữ kiện dùng để trả lương.
   */
  async checkOut(
    user: AuthenticatedUser,
    dto: CheckOutDto,
  ): Promise<AttendanceResponseDto> {
    const employeeId = this.requireOwnEmployeeId(user);
    const { date, time } = vietnamDateTime();

    const record = await this.attendancesRepository.findByEmployeeAndDate(
      employeeId,
      date,
    );

    if (!record?.checkIn) {
      throw new NotFoundException({
        code: 'NOT_CHECKED_IN',
        message: `Employee ${employeeId} has not checked in on ${date}`,
      });
    }

    if (record.checkOut) {
      throw new ConflictException({
        code: 'ALREADY_CHECKED_OUT',
        message: `Employee ${employeeId} already checked out at ${record.checkOut} on ${date}`,
      });
    }

    this.applyTimes(record, record.checkIn, time);
    record.note = dto.note?.trim() || record.note || null;

    return this.toResponse(await this.attendancesRepository.save(record));
  }

  // ------------------------------------------------------------ đọc ----

  /** `GET /attendances` — danh sách toàn công ty, giới hạn theo phạm vi của người gọi. */
  async findAll(
    filter: FilterAttendanceDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<AttendanceResponseDto>> {
    const scope = await this.employeesService.resolveScope(user);

    if (scope.kind === 'self') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Role "${user.role}" cannot list attendance records; use GET /attendances/me instead`,
      });
    }

    const { page, limit, skip } = resolvePagination(filter);

    const [records, total] = await this.attendancesRepository.findPaginated({
      skip,
      take: limit,
      sort: filter.sort ?? 'workDate',
      order: filter.order === 'asc' ? 'ASC' : 'DESC',
      employeeId: filter.employeeId,
      departmentId: filter.departmentId,
      status: filter.status,
      dateRange: this.resolveDateRange(filter.month, filter.year),
      departmentScope:
        scope.kind === 'department' ? scope.departmentIds : undefined,
    });

    return new PaginatedResponseDto(
      records.map((record) => this.toResponse(record)),
      total,
      page,
      limit,
    );
  }

  /** `GET /attendances/me` — bảng công tháng của chính người đang đăng nhập. */
  async findMine(
    user: AuthenticatedUser,
    query: MonthQueryDto,
  ): Promise<MyAttendanceResponseDto> {
    const employeeId = this.requireOwnEmployeeId(user);
    const today = vietnamDateTime().date;
    const month = query.month ?? Number(today.slice(5, 7));
    const year = query.year ?? Number(today.slice(0, 4));
    const range = this.monthRange(month, year);

    const records = await this.attendancesRepository.findByEmployeeInRange(
      employeeId,
      range.from,
      range.to,
    );

    return {
      month,
      year,
      summary: await this.buildSummary(employeeId, month, year, records, today),
      records: records.map((record) => this.toResponse(record)),
    };
  }

  // -------------------------------------------------------- điều chỉnh ----

  /**
   * `PATCH /attendances/:id` — HR sửa khi máy lỗi hoặc nhân viên quên chấm.
   *
   * Mọi trường giờ được sửa đều kéo theo TÍNH LẠI giờ công, đi muộn, về sớm.
   * Cho sửa `check_out` mà giữ nguyên `work_hours` cũ sẽ để lại một bản ghi
   * tự mâu thuẫn, và không ai biết con số nào đã dùng để trả lương.
   */
  async update(
    id: number,
    dto: UpdateAttendanceDto,
    user: AuthenticatedUser,
  ): Promise<AttendanceResponseDto> {
    const record = await this.getExistingOrThrow(id);
    await this.assertCanManage(record, user);

    const checkIn = dto.checkIn ?? record.checkIn;
    const checkOut = dto.checkOut ?? record.checkOut;

    if (
      checkIn &&
      checkOut &&
      parseTimeToMinutes(checkOut) < parseTimeToMinutes(checkIn)
    ) {
      throw new ConflictException({
        code: 'INVALID_ATTENDANCE_TIMES',
        message: `check-out (${checkOut}) is earlier than check-in (${checkIn})`,
      });
    }

    if (checkIn && checkOut) {
      this.applyTimes(record, checkIn, checkOut);
    } else if (checkIn) {
      record.checkIn = normaliseTime(checkIn);
      record.isLate = this.isLateArrival(checkIn);
      record.lateMinutes = this.minutesLate(checkIn);
      record.status = record.isLate
        ? AttendanceStatus.LATE
        : AttendanceStatus.PRESENT;
    }

    // Trạng thái do HR chỉ định (wfh, leave, holiday...) ghi đè kết quả tính
    // tự động: máy không biết hôm đó nhân viên làm ở nhà.
    if (dto.status) {
      record.status = dto.status;
    }

    record.note = dto.note.trim();

    return this.toResponse(await this.attendancesRepository.save(record));
  }

  async findOne(
    id: number,
    user: AuthenticatedUser,
  ): Promise<AttendanceResponseDto> {
    const record = await this.getExistingOrThrow(id);
    await this.assertCanRead(record, user);

    return this.toResponse(record);
  }

  // ------------------------------------------------------- nội bộ ----

  /**
   * Ghi giờ vào/ra và tính lại toàn bộ số liệu dẫn xuất.
   *
   * Một chỗ duy nhất tính, dùng cho cả `checkOut` lẫn `update` — hai công thức
   * song song là cách chắc chắn nhất để bảng công của người tự chấm và người
   * được HR sửa ra hai kết quả khác nhau.
   */
  private applyTimes(
    record: Attendance,
    checkIn: string,
    checkOut: string,
  ): void {
    const computed = calculateWorkHours({ checkIn, checkOut });

    record.checkIn = normaliseTime(checkIn);
    record.checkOut = normaliseTime(checkOut);
    record.workHours = computed.workHours.toFixed(2);
    record.overtimeHours = computed.overtimeHours.toFixed(2);
    record.isLate = computed.isLate;
    record.lateMinutes = computed.lateMinutes;
    record.isEarlyLeave = computed.isEarlyLeave;
    record.earlyLeaveMinutes = computed.earlyLeaveMinutes;
    record.status = this.resolveStatus(computed.isLate, computed.isEarlyLeave);
  }

  /**
   * Trạng thái theo business-rules §12.4.
   *
   * Vừa đi muộn vừa về sớm thì cột `status` chỉ chứa được một giá trị — ưu tiên
   * `late`. Không mất thông tin: `is_early_leave` và `early_leave_minutes` vẫn
   * được ghi đầy đủ, `status` chỉ là nhãn hiển thị nhanh.
   */
  private resolveStatus(
    isLate: boolean,
    isEarlyLeave: boolean,
  ): AttendanceStatus {
    if (isLate) {
      return AttendanceStatus.LATE;
    }

    return isEarlyLeave
      ? AttendanceStatus.EARLY_LEAVE
      : AttendanceStatus.PRESENT;
  }

  private isLateArrival(time: string): boolean {
    return calculateWorkHours({ checkIn: time, checkOut: time }).isLate;
  }

  private minutesLate(time: string): number {
    return calculateWorkHours({ checkIn: time, checkOut: time }).lateMinutes;
  }

  /**
   * Tổng hợp một tháng.
   *
   * `absentDays` chỉ đếm tới NGÀY HÔM NAY: những ngày còn lại của tháng chưa
   * xảy ra, đếm chúng là vắng sẽ biến bảng công đầu tháng thành một bản báo
   * cáo kỷ luật sai sự thật.
   */
  private async buildSummary(
    employeeId: number,
    month: number,
    year: number,
    records: Attendance[],
    today: string,
  ): Promise<AttendanceSummaryDto> {
    const range = this.monthRange(month, year);
    const holidays = await this.holidayDates(year);
    const workingDays = this.countWorkingDays(range.from, range.to, holidays);

    // Ngày làm việc đã trôi qua tính tới hôm nay (tháng tương lai → rỗng).
    const elapsedTo =
      today < range.from ? null : today < range.to ? today : range.to;
    const elapsedWorkingDates =
      elapsedTo === null
        ? []
        : this.workingDaysBetween(range.from, elapsedTo, holidays);

    const recordedDates = new Set(
      records.map((record) => toDateOnlyString(record.workDate)),
    );
    const counted = records.reduce(
      (totals, record) => ({
        present: totals.present + (record.checkIn ? 1 : 0),
        late: totals.late + (record.isLate ? 1 : 0),
        earlyLeave: totals.earlyLeave + (record.isEarlyLeave ? 1 : 0),
        leave:
          totals.leave + (record.status === AttendanceStatus.LEAVE ? 1 : 0),
        workHours: totals.workHours + Number(record.workHours ?? 0),
        overtimeHours: totals.overtimeHours + Number(record.overtimeHours ?? 0),
      }),
      {
        present: 0,
        late: 0,
        earlyLeave: 0,
        leave: 0,
        workHours: 0,
        overtimeHours: 0,
      },
    );

    /*
     * Vắng = ngày làm việc đã qua mà KHÔNG có bản ghi nào. Ngày nghỉ phép đã
     * duyệt sẽ có bản ghi `status = leave` (Giai đoạn 5 ghi vào đây), nên nó tự
     * rơi ra khỏi phép trừ này mà không cần đọc bảng `leave_requests`.
     */
    const absentDays = elapsedWorkingDates.filter(
      (date) => !recordedDates.has(date),
    ).length;

    return {
      workingDays,
      presentDays: counted.present,
      absentDays,
      lateDays: counted.late,
      earlyLeaveDays: counted.earlyLeave,
      leaveDays: counted.leave,
      totalWorkHours: round2(counted.workHours),
      overtimeHours: round2(counted.overtimeHours),
      approvedOvertimeHours: await this.overtimeService.sumApprovedHours(
        employeeId,
        range.from,
        range.to,
      ),
    };
  }

  private async holidayDates(year: number): Promise<Set<string>> {
    const holidays = await this.holidaysService.findByYear(year);
    return new Set(holidays.map((holiday) => holiday.holidayDate));
  }

  /** Ngày làm việc = Thứ Hai–Thứ Sáu và không phải ngày lễ. */
  private workingDaysBetween(
    from: string,
    to: string,
    holidays: Set<string>,
  ): string[] {
    const days: string[] = [];
    const cursor = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);

    while (cursor <= end) {
      const date = cursor.toISOString().slice(0, 10);
      const dayOfWeek = cursor.getUTCDay();

      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(date)) {
        days.push(date);
      }

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return days;
  }

  private countWorkingDays(
    from: string,
    to: string,
    holidays: Set<string>,
  ): number {
    return this.workingDaysBetween(from, to, holidays).length;
  }

  /** `month`/`year` → khoảng ngày `YYYY-MM-DD` của cả tháng. */
  private monthRange(
    month: number,
    year: number,
  ): { from: string; to: string } {
    const pad = (value: number): string => `${value}`.padStart(2, '0');
    // Ngày 0 của tháng SAU chính là ngày cuối tháng này — không phải nhớ 30/31
    // hay năm nhuận.
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

    return {
      from: `${year}-${pad(month)}-01`,
      to: `${year}-${pad(month)}-${pad(lastDay)}`,
    };
  }

  /**
   * `month`+`year` → khoảng ngày cho bộ lọc.
   *
   * Chỉ có `year` thì lọc cả năm. Chỉ có `month` mà không có `year` thì BỎ QUA
   * hoàn toàn: "tháng 5" của năm nào là câu hỏi không có đáp án, và tự điền năm
   * hiện tại sẽ trả về dữ liệu mà người dùng không hề yêu cầu.
   */
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

    return this.monthRange(month, year);
  }

  private requireOwnEmployeeId(user: AuthenticatedUser): number {
    if (user.employeeId === null || user.employeeId === undefined) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `User ${user.userId} has no employee profile and cannot record attendance`,
      });
    }

    return Number(user.employeeId);
  }

  private async getExistingOrThrow(id: number): Promise<Attendance> {
    const record = await this.attendancesRepository.findById(id);

    if (!record) {
      throw new NotFoundException({
        code: 'ATTENDANCE_NOT_FOUND',
        message: `Attendance record ${id} not found`,
      });
    }

    return record;
  }

  /** Đọc một bản ghi: HR đọc tất cả, manager đọc phòng mình, nhân viên đọc của mình. */
  private async assertCanRead(
    record: Attendance,
    user: AuthenticatedUser,
  ): Promise<void> {
    const scope = await this.employeesService.resolveScope(user);

    if (scope.kind === 'all') {
      return;
    }

    if (scope.kind === 'self') {
      if (Number(record.employeeId) !== scope.employeeId) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: `User ${user.userId} cannot read attendance of employee ${record.employeeId}`,
        });
      }
      return;
    }

    const departmentId = record.employee?.departmentId;

    if (
      departmentId === undefined ||
      !scope.departmentIds.includes(Number(departmentId))
    ) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `User ${user.userId} cannot read attendance outside their departments`,
      });
    }
  }

  /**
   * Sửa một bản ghi: CHỈ nhóm HR (`scope.kind === 'all'`).
   *
   * Manager cố tình bị loại dù họ đọc được phòng mình: sửa bảng chấm công là
   * sửa căn cứ trả lương, để trưởng phòng tự sửa giờ cho nhân viên phòng mình
   * là bỏ luôn lớp kiểm soát duy nhất của việc đó.
   */
  private async assertCanManage(
    record: Attendance,
    user: AuthenticatedUser,
  ): Promise<void> {
    const scope = await this.employeesService.resolveScope(user);

    if (scope.kind !== 'all') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Role "${user.role}" cannot adjust attendance record ${record.id}`,
      });
    }
  }

  private toResponse(record: Attendance): AttendanceResponseDto {
    const employee = record.employee;

    return {
      id: Number(record.id),
      employeeId: Number(record.employeeId),
      employee: employee
        ? {
            id: Number(employee.id),
            employeeCode: employee.employeeCode,
            fullName: employee.fullName,
            departmentName: employee.department?.name ?? null,
          }
        : null,
      workDate: toDateOnlyString(record.workDate),
      checkIn: record.checkIn ? shortTime(record.checkIn) : null,
      checkOut: record.checkOut ? shortTime(record.checkOut) : null,
      // Phải bắt CẢ `undefined`: bản ghi vừa dựng trong bộ nhớ chưa có giá trị
      // (TypeORM chỉ áp `default:` lúc INSERT), và `Number(undefined)` ra NaN —
      // tức là "giờ công = NaN" trên màn hình chấm công.
      workHours:
        record.workHours === null || record.workHours === undefined
          ? null
          : Number(record.workHours),
      overtimeHours: Number(record.overtimeHours ?? 0),
      isLate: record.isLate,
      lateMinutes: record.lateMinutes,
      isEarlyLeave: record.isEarlyLeave,
      earlyLeaveMinutes: record.earlyLeaveMinutes,
      status: record.status,
      note: record.note,
      createdAt: toIsoString(record.createdAt),
      updatedAt: toIsoString(record.updatedAt),
    };
  }
}

/**
 * Bản ghi chấm công RỖNG, đã điền đủ mặc định.
 *
 * `new Attendance()` KHÔNG có các `default:` khai báo trên entity — TypeORM chỉ
 * áp chúng khi INSERT xuống DB. Bản ghi vừa dựng vì thế có `workHours`,
 * `isEarlyLeave`... là `undefined`, và response trả ra `NaN`/`undefined` cho
 * tới khi nó được đọc lại từ DB. PLAN 4.1 quy định rõ: chưa chấm ra thì giờ
 * công phải là `null`.
 */
function newAttendance(): Attendance {
  const record = new Attendance();

  record.checkOut = null;
  record.workHours = null;
  record.overtimeHours = '0.00';
  record.isLate = false;
  record.lateMinutes = 0;
  record.isEarlyLeave = false;
  record.earlyLeaveMinutes = 0;
  record.leaveRequestId = null;
  record.note = null;

  return record;
}

/** Cột `TIME` của MySQL cần `HH:mm:ss`; DTO nhận `HH:mm`. */
function normaliseTime(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}

/** `HH:mm:ss` từ DB → `HH:mm` cho response (api-spec.md §7 dùng `"08:05"`). */
function shortTime(time: string): string {
  return formatMinutesToTime(parseTimeToMinutes(time));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
