import {
  ForbiddenException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Workbook } from 'exceljs';
import { STANDARD_WORK_HOURS_PER_DAY } from '@/common/constants/attendance.constant';
import {
  ROLE_ADMIN,
  ROLE_HR_MANAGER,
  ROLE_HR_STAFF,
  ROLE_MANAGER,
} from '@/common/constants/roles.constant';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { AttendancesService } from '@/modules/attendances/attendances.service';
import { AttendanceResponseDto } from '@/modules/attendances/dto/attendance-response.dto';
import { AttendanceStatus } from '@/modules/attendances/entities/attendance.entity';
import { ExportAttendancesDto } from './dto/export-attendances.dto';
import {
  addStyledSheet,
  buildContentDisposition,
  ExcelCellValue,
  ExcelColumnSpec,
  toAsciiFilename,
  toExcelDate,
} from './utils/excel.util';

/**
 * `GET /reports/attendances/export` — bảng chấm công một tháng ra Excel
 * (PLAN 4.1, api-spec.md §19).
 *
 * Hai sheet:
 *  - **Chi tiết** — mỗi dòng một ngày công của một người.
 *  - **Tổng hợp** — mỗi dòng một người, cộng dồn cả tháng. Đây là sheet mà bộ
 *    phận lương thực sự dùng; sheet chi tiết là để đối chiếu khi có tranh chấp.
 *
 * ĐỌC QUA `AttendancesService`, KHÔNG đọc thẳng repository: phạm vi dữ liệu
 * (`resolveScope`) nằm ở service, đi vòng qua nó là tạo ra một đường lấy dữ
 * liệu không có phân quyền — trưởng phòng sẽ xuất được cả công ty.
 */
@Injectable()
export class AttendanceExportService {
  private readonly logger = new Logger(AttendanceExportService.name);

  constructor(private readonly attendancesService: AttendancesService) {}

  /**
   * Vai trò được xuất bảng chấm công.
   *
   * `manager` CÓ trong danh sách (khác với bản xuất danh sách nhân viên): bảng
   * công là công cụ điều hành hằng ngày của trưởng phòng, và họ vốn đã xem được
   * từng dòng trên màn hình. Phạm vi vẫn bị `resolveScope` giới hạn trong phòng
   * họ quản. Đây là hằng RIÊNG của module này chứ không dùng lại của bản xuất
   * nhân viên — nới quyền ở một bản xuất không được kéo theo bản xuất kia.
   */
  static readonly EXPORT_ROLES: string[] = [
    ROLE_ADMIN,
    ROLE_HR_MANAGER,
    ROLE_HR_STAFF,
    ROLE_MANAGER,
  ];

  /**
   * Trần số dòng của sheet chi tiết.
   *
   * Một tháng × 300 nhân viên đã là ~6.600 dòng. Vượt trần thì BÁO LỖI chứ
   * không cắt bớt: một bảng công thiếu ngày trông y hệt một bảng công đầy đủ,
   * và nó được dùng để trả lương.
   */
  static readonly MAX_EXPORT_ROWS = 20_000;

  async exportMonth(
    filter: ExportAttendancesDto,
    user: AuthenticatedUser,
  ): Promise<{ buffer: Buffer; filename: string; contentDisposition: string }> {
    if (!AttendanceExportService.EXPORT_ROLES.includes(user.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Role "${user.role}" cannot export attendance; requires one of roles: ${AttendanceExportService.EXPORT_ROLES.join(', ')}`,
      });
    }

    const records = await this.readAllPages(filter, user);
    const workbook = this.buildWorkbook(records, filter);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    this.logger.log(
      `Attendance export for ${filter.month}/${filter.year} by user ${user.userId} (${user.role}): ${records.length} rows`,
    );

    return { buffer, ...this.buildFilenames(filter) };
  }

  /**
   * Đọc hết các trang qua `AttendancesService.findAll`.
   *
   * Trần được kiểm lại SAU MỖI TRANG chứ không chỉ ở trang đầu: có người đang
   * chấm công trong lúc file đang được dựng, và một lần chèn đồng thời không
   * được phép biến file thành bản cắt cụt im lặng.
   */
  private async readAllPages(
    filter: ExportAttendancesDto,
    user: AuthenticatedUser,
  ): Promise<AttendanceResponseDto[]> {
    const pageSize = 100;
    const all: AttendanceResponseDto[] = [];

    for (let page = 1; ; page += 1) {
      const result = await this.attendancesService.findAll(
        {
          page,
          limit: pageSize,
          sort: 'workDate',
          order: 'asc',
          month: filter.month,
          year: filter.year,
          departmentId: filter.departmentId,
          employeeId: filter.employeeId,
        },
        user,
      );

      all.push(...result.items);

      if (all.length > AttendanceExportService.MAX_EXPORT_ROWS) {
        throw new UnprocessableEntityException({
          code: 'EXPORT_TOO_MANY_ROWS',
          message: `The current filter matches over ${AttendanceExportService.MAX_EXPORT_ROWS} attendance rows; narrow it by department and export again`,
        });
      }

      if (result.items.length < pageSize || all.length >= result.meta.total) {
        return all;
      }
    }
  }

  private buildWorkbook(
    records: AttendanceResponseDto[],
    filter: ExportAttendancesDto,
  ): Workbook {
    const workbook = new Workbook();
    workbook.creator = 'HRM';
    workbook.created = new Date();

    addStyledSheet(
      workbook,
      'Chi tiết',
      DETAIL_COLUMNS,
      records.map((record, index) => this.detailRow(record, index)),
    );

    addStyledSheet(
      workbook,
      'Tổng hợp',
      SUMMARY_COLUMNS,
      this.summaryRows(records),
    );

    this.logger.debug(
      `Built attendance workbook for ${filter.month}/${filter.year}`,
    );

    return workbook;
  }

  private detailRow(
    record: AttendanceResponseDto,
    index: number,
  ): ExcelCellValue[] {
    return [
      index + 1,
      record.employee?.employeeCode ?? '',
      record.employee?.fullName ?? '',
      record.employee?.departmentName ?? '',
      toExcelDate(record.workDate),
      record.checkIn ?? '',
      record.checkOut ?? '',
      // Trống = không rõ giờ nghỉ, giờ công tính theo khung nghỉ chuẩn.
      record.breakStart ?? '',
      record.breakEnd ?? '',
      record.workHours,
      record.overtimeHours,
      record.lateMinutes,
      record.earlyLeaveMinutes,
      STATUS_LABELS[record.status] ?? record.status,
      record.note ?? '',
    ];
  }

  /**
   * Một dòng mỗi người: cộng dồn cả tháng.
   *
   * Gom theo `employeeId` chứ không theo tên — hai người trùng tên là chuyện
   * bình thường ở Việt Nam, gom theo tên sẽ cộng công của họ vào làm một.
   */
  private summaryRows(records: AttendanceResponseDto[]): ExcelCellValue[][] {
    const byEmployee = new Map<
      number,
      {
        code: string;
        name: string;
        department: string;
        days: number;
        workHours: number;
        overtimeHours: number;
        lateDays: number;
        earlyLeaveDays: number;
        leaveDays: number;
      }
    >();

    for (const record of records) {
      const key = record.employeeId;
      const current = byEmployee.get(key) ?? {
        code: record.employee?.employeeCode ?? '',
        name: record.employee?.fullName ?? '',
        department: record.employee?.departmentName ?? '',
        days: 0,
        workHours: 0,
        overtimeHours: 0,
        lateDays: 0,
        earlyLeaveDays: 0,
        leaveDays: 0,
      };

      current.days += record.checkIn ? 1 : 0;
      current.workHours += record.workHours ?? 0;
      current.overtimeHours += record.overtimeHours;
      current.lateDays += record.isLate ? 1 : 0;
      current.earlyLeaveDays += record.isEarlyLeave ? 1 : 0;
      current.leaveDays += record.status === AttendanceStatus.LEAVE ? 1 : 0;

      byEmployee.set(key, current);
    }

    return [...byEmployee.values()].map((row, index) => [
      index + 1,
      row.code,
      row.name,
      row.department,
      row.days,
      round2(row.workHours),
      round2(row.overtimeHours),
      row.lateDays,
      row.earlyLeaveDays,
      row.leaveDays,
      // Quy ra ngày công để đối chiếu với bảng lương, làm tròn 2 số.
      round2(row.workHours / STANDARD_WORK_HOURS_PER_DAY),
    ]);
  }

  private buildFilenames(filter: ExportAttendancesDto): {
    filename: string;
    contentDisposition: string;
  } {
    const month = `${filter.month}`.padStart(2, '0');
    const utf8Filename = `Bảng chấm công ${month}-${filter.year}.xlsx`;
    const filename = toAsciiFilename(utf8Filename);

    return {
      filename,
      contentDisposition: buildContentDisposition(filename, utf8Filename),
    };
  }
}

const HOURS_NUMBER_FORMAT = '0.00';

const DETAIL_COLUMNS: ExcelColumnSpec[] = [
  { header: 'STT', width: 6 },
  { header: 'Mã NV', width: 12 },
  { header: 'Họ và tên', width: 26 },
  { header: 'Phòng ban', width: 24 },
  { header: 'Ngày', width: 13, numberFormat: 'dd/mm/yyyy' },
  { header: 'Giờ vào', width: 10 },
  { header: 'Giờ ra', width: 10 },
  { header: 'Nghỉ từ', width: 10 },
  { header: 'Nghỉ đến', width: 10 },
  { header: 'Giờ công', width: 11, numberFormat: HOURS_NUMBER_FORMAT },
  {
    header: 'Giờ vượt ca (thực tế)',
    width: 20,
    numberFormat: HOURS_NUMBER_FORMAT,
  },
  { header: 'Đi muộn (phút)', width: 15 },
  { header: 'Về sớm (phút)', width: 15 },
  { header: 'Trạng thái', width: 16 },
  { header: 'Ghi chú', width: 30 },
];

const SUMMARY_COLUMNS: ExcelColumnSpec[] = [
  { header: 'STT', width: 6 },
  { header: 'Mã NV', width: 12 },
  { header: 'Họ và tên', width: 26 },
  { header: 'Phòng ban', width: 24 },
  { header: 'Số ngày có công', width: 16 },
  { header: 'Tổng giờ công', width: 15, numberFormat: HOURS_NUMBER_FORMAT },
  {
    header: 'Giờ vượt ca (thực tế)',
    width: 20,
    numberFormat: HOURS_NUMBER_FORMAT,
  },
  { header: 'Số ngày đi muộn', width: 16 },
  { header: 'Số ngày về sớm', width: 16 },
  { header: 'Số ngày nghỉ phép', width: 17 },
  { header: 'Quy ra ngày công', width: 17, numberFormat: HOURS_NUMBER_FORMAT },
];

/** Nhãn tiếng Việt của `AttendanceStatus` — file này người Việt đọc. */
const STATUS_LABELS: Record<string, string> = {
  [AttendanceStatus.PRESENT]: 'Đi làm',
  [AttendanceStatus.ABSENT]: 'Vắng',
  [AttendanceStatus.LATE]: 'Đi muộn',
  [AttendanceStatus.EARLY_LEAVE]: 'Về sớm',
  [AttendanceStatus.LEAVE]: 'Nghỉ phép',
  [AttendanceStatus.HOLIDAY]: 'Ngày lễ',
  [AttendanceStatus.WFH]: 'Làm từ xa',
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
