import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { toDateOnlyString, toIsoString } from '@/common/utils/date.util';
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
import { AttendanceResponseDto } from './dto/attendance-response.dto';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { FilterAttendanceDto } from './dto/filter-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { Attendance, AttendanceStatus } from './entities/attendance.entity';

/**
 * Nghiệp vụ chấm công (PLAN 4.1, business-rules.md §12).
 *
 * ========== HỆ THỐNG NÀY KHÔNG CÓ CHỨC NĂNG CHẤM CÔNG ==========
 * Không ai bấm "chấm vào"/"chấm ra" ở đây. Việc chấm công diễn ra trên NỀN
 * TẢNG NGOÀI (máy chấm công / ứng dụng riêng của công ty); dữ liệu được đưa
 * vào bằng hai đường, cả hai đều do người của bộ phận nhân sự thực hiện:
 *
 *   1. `POST /attendances/bulk-import` — nạp file Excel xuất từ nền tảng đó.
 *      Đây là đường chính, dùng cho cả tháng.
 *   2. `POST /attendances` — gõ tay từng dòng, cho những ca lẻ mà file không
 *      có: quên chấm, đi công tác, làm tại nhà.
 *
 * Nhân viên thường KHÔNG đăng nhập hệ thống này (xem `PORTAL_LOGIN_ROLES`), nên
 * ở đây không có endpoint nào "của tôi". Cổng tra cứu cá nhân là một ứng dụng
 * riêng sẽ xây sau.
 *
 * `attendances.overtime_hours` KHÔNG PHẢI CĂN CỨ TRẢ TIỀN. Nó là số giờ suy ra
 * từ giờ vào/ra. Tiền làm thêm trả theo đơn đã duyệt ở `OvertimeService`.
 *
 * Riêng `PATCH` vẫn BẮT BUỘC ghi lý do: sửa một con số đã có khác với nhập một
 * con số chưa có — bản ghi sau khi sửa phải nói được vì sao nó khác dữ liệu gốc.
 */
@Injectable()
export class AttendancesService {
  constructor(
    private readonly attendancesRepository: AttendancesRepository,
    private readonly employeesService: EmployeesService,
    private readonly holidaysService: HolidaysService,
    private readonly overtimeService: OvertimeService,
  ) {}

  // --------------------------------------------------------- nhập tay ----

  /**
   * `POST /attendances` — nhập MỘT ngày công.
   *
   * Dành cho những ca lẻ mà file từ nền tảng ngoài không có: quên chấm, đi công
   * tác, làm tại nhà. Đường chính vẫn là nạp Excel.
   *
   * TRÙNG NGÀY THÌ TỪ CHỐI, không ghi đè. Cột UNIQUE (employee_id, work_date)
   * sẽ chặn ở DB, nhưng bắt sớm ở đây thì người nhập nhận được câu trả lời có
   * nghĩa thay vì lỗi driver — và quan trọng hơn, họ được biết là ngày đó ĐÃ
   * CÓ dữ liệu để chuyển sang sửa thay vì tạo mới.
   */
  async create(
    dto: CreateAttendanceDto,
    user: AuthenticatedUser,
  ): Promise<AttendanceResponseDto> {
    await this.assertCanManageEmployee(dto.employeeId, user);

    const existing = await this.attendancesRepository.findByEmployeeAndDate(
      dto.employeeId,
      dto.workDate,
    );

    if (existing) {
      throw new ConflictException({
        code: 'ATTENDANCE_ALREADY_EXISTS',
        message: `Employee ${dto.employeeId} already has an attendance record on ${dto.workDate}; edit record ${existing.id} instead`,
      });
    }

    if (
      dto.checkIn &&
      dto.checkOut &&
      parseTimeToMinutes(dto.checkOut) < parseTimeToMinutes(dto.checkIn)
    ) {
      throw new ConflictException({
        code: 'INVALID_ATTENDANCE_TIMES',
        message: `check-out (${dto.checkOut}) is earlier than check-in (${dto.checkIn})`,
      });
    }

    /*
     * Không có giờ vào thì PHẢI nói rõ ngày đó là gì. Thiếu cả hai, bản ghi rơi
     * về mặc định `present` của cột — tức là một dòng khẳng định người ta có
     * mặt mà không có một dữ kiện nào chống lưng. Với dữ liệu dùng để trả
     * lương, đó là thứ tệ hơn cả việc thiếu dòng.
     */
    if (!dto.checkIn && !dto.status) {
      throw new UnprocessableEntityException({
        code: 'ATTENDANCE_STATUS_REQUIRED',
        message:
          'A record without a check-in time must state its status (leave, holiday, wfh, absent...)',
      });
    }

    const record = newAttendance();
    record.employeeId = dto.employeeId;
    record.workDate = dto.workDate;

    if (dto.checkIn && dto.checkOut) {
      this.applyTimes(record, dto.checkIn, dto.checkOut, {
        start: dto.breakStart ?? null,
        end: dto.breakEnd ?? null,
      });
    } else if (dto.checkIn) {
      // Chỉ có giờ vào: giờ công để `null`, KHÔNG phải 0 — hai thứ khác hẳn nhau.
      const arrival = calculateWorkHours({
        checkIn: dto.checkIn,
        checkOut: dto.checkIn,
      });
      record.checkIn = normaliseTime(dto.checkIn);
      record.isLate = arrival.isLate;
      record.lateMinutes = arrival.lateMinutes;
      record.status = arrival.isLate
        ? AttendanceStatus.LATE
        : AttendanceStatus.PRESENT;
    }

    /*
     * Trạng thái do người nhập chỉ định thắng kết quả tính tự động: một ngày
     * nghỉ phép hay ngày làm tại nhà không có giờ vào/ra nào để suy ra.
     */
    if (dto.status) {
      record.status = dto.status;
    }

    record.note = dto.note?.trim() || null;

    const saved = await this.attendancesRepository.create(record);

    return this.toResponse(
      (await this.attendancesRepository.findById(Number(saved.id))) ?? saved,
    );
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
      this.applyTimes(record, checkIn, checkOut, {
        start: dto.breakStart ?? record.breakStart,
        end: dto.breakEnd ?? record.breakEnd,
      });
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

    record.note = dto.note?.trim() || null;

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
    breakTimes?: { start?: string | null; end?: string | null },
  ): void {
    /*
     * Giờ nghỉ lấy từ tham số nếu có, KHÔNG thì đọc lại giá trị đang nằm trên
     * bản ghi. Bỏ qua giá trị cũ sẽ khiến một lần sửa mỗi giờ ra âm thầm ném đi
     * giờ nghỉ thật mà file import đã mang vào.
     */
    const breakStart = breakTimes?.start ?? record.breakStart ?? null;
    const breakEnd = breakTimes?.end ?? record.breakEnd ?? null;

    const computed = calculateWorkHours({
      checkIn,
      checkOut,
      breakStart,
      breakEnd,
    });

    record.checkIn = normaliseTime(checkIn);
    record.checkOut = normaliseTime(checkOut);
    record.breakStart = breakStart === null ? null : normaliseTime(breakStart);
    record.breakEnd = breakEnd === null ? null : normaliseTime(breakEnd);
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
  /**
   * Ai được TẠO một dòng chấm công cho nhân viên nào.
   *
   * Chỉ nhóm HR (`scope.kind === 'all'`), giống `assertCanManage`. Trưởng phòng
   * đọc được bảng công phòng mình nhưng không nhập, không sửa — nhập tay là
   * tạo ra một căn cứ trả lương không có bằng chứng từ máy chấm công, và đó là
   * lớp kiểm soát duy nhất của việc đó.
   *
   * `employeeId` được kiểm luôn ở đây: nhập cho một hồ sơ không tồn tại sẽ chỉ
   * nhận lỗi khoá ngoại từ driver, không nói được là sai ở đâu.
   */
  private async assertCanManageEmployee(
    employeeId: number,
    user: AuthenticatedUser,
  ): Promise<void> {
    const scope = await this.employeesService.resolveScope(user);

    if (scope.kind !== 'all') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Role "${user.role}" cannot create attendance records`,
      });
    }

    await this.employeesService.findOne(employeeId, user);
  }

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
      breakStart: record.breakStart ? shortTime(record.breakStart) : null,
      breakEnd: record.breakEnd ? shortTime(record.breakEnd) : null,
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
  record.breakStart = null;
  record.breakEnd = null;
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
