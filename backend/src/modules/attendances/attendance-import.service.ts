import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CellValue, Row, Workbook } from 'exceljs';
import { UploadedFileLike } from '@/shared/storage/image-file.util';
import { toDateOnlyString } from '@/common/utils/date.util';
import {
  OvertimeRateType,
  resolveRateType,
} from '@/common/utils/overtime.util';
import {
  calculateWorkHours,
  formatMinutesToTime,
  parseTimeToMinutes,
} from '@/common/utils/work-hours.util';
import { EmployeesRepository } from '@/modules/employees/employees.repository';
import { HolidaysService } from '@/modules/system/holidays.service';
import { AttendancesRepository } from './attendances.repository';
import {
  AttendanceImportErrorDto,
  AttendanceImportResultDto,
} from './dto/import-attendance.dto';
import { Attendance, AttendanceStatus } from './entities/attendance.entity';

/**
 * `POST /attendances/bulk-import` — nhập bảng chấm công từ file máy chấm công
 * (api-spec.md §7).
 *
 * ==================== TẤT CẢ HOẶC KHÔNG GÌ CẢ ====================
 * Chỉ cần MỘT dòng sai là KHÔNG dòng nào được ghi. Đây là lựa chọn có chủ ý và
 * ngược với cách import "bỏ qua dòng lỗi" thường gặp.
 *
 * Lý do: đây là dữ liệu để trả lương. Nhập một phần sẽ để lại một tháng công
 * nửa vời mà HR phải tự dò xem thiếu ai, thiếu ngày nào — và một bảng công
 * thiếu ngày trông y hệt một bảng công đầy đủ. Trả về TOÀN BỘ danh sách lỗi
 * kèm số dòng để họ sửa file một lần rồi nạp lại, thay vì nạp nhiều lần và mỗi
 * lần lại phải nhớ lần trước đã vào được tới đâu.
 *
 * `dryRun` cho phép xem trước kết quả mà không ghi gì — màn hình import gọi nó
 * trước, rồi mới gọi lần thật.
 *
 * ĐÈ LÊN DỮ LIỆU CŨ ĐƯỢC ĐẾM RIÊNG. File máy chấm công thường được nạp lại sau
 * khi sửa, nên ghi đè là hành vi đúng; nhưng số bản ghi bị đè luôn được báo về
 * (`updated`) để không ai vô tình thay đổi ngày công đã chốt mà không biết.
 */
@Injectable()
export class AttendanceImportService {
  private readonly logger = new Logger(AttendanceImportService.name);

  constructor(
    private readonly attendancesRepository: AttendancesRepository,
    private readonly employeesRepository: EmployeesRepository,
    private readonly holidaysService: HolidaysService,
  ) {}

  /** Giới hạn số dòng — file lớn hơn gần như luôn là file sai, không phải một tháng công. */
  static readonly MAX_IMPORT_ROWS = 20_000;

  /**
   * Tiêu đề cột được chấp nhận, so khớp KHÔNG phân biệt hoa thường và dấu.
   *
   * Nhiều biến thể vì file đến từ nhiều nguồn: bản xuất của chính hệ thống này,
   * phần mềm máy chấm công, hoặc HR tự gõ. Bắt đúng một chuỗi duy nhất thì mọi
   * file thật đều bị từ chối vì lý do không liên quan gì đến dữ liệu.
   */
  private static readonly COLUMN_ALIASES: Record<string, string[]> = {
    employeeCode: ['ma nv', 'ma nhan vien', 'employee code', 'ma so nv'],
    workDate: ['ngay', 'ngay cong', 'work date', 'date'],
    checkIn: ['gio vao', 'check in', 'gio den'],
    checkOut: ['gio ra', 'check out', 'gio ve'],
    breakStart: ['gio nghi tu', 'bat dau nghi', 'break start', 'gio nghi'],
    breakEnd: ['gio nghi den', 'ket thuc nghi', 'break end', 'gio vao lam lai'],
    note: ['ghi chu', 'note'],
  };

  async importFromFile(
    file: UploadedFileLike | undefined,
    options: { dryRun: boolean },
  ): Promise<AttendanceImportResultDto> {
    const workbook = await this.readWorkbook(file);
    const sheet = workbook.worksheets[0];

    if (!sheet) {
      throw new BadRequestException({
        code: 'IMPORT_EMPTY_FILE',
        message: 'The uploaded workbook has no worksheet',
      });
    }

    const columns = this.resolveColumns(sheet.getRow(1));
    const parsed = this.parseRows(sheet, columns);

    /*
     * Tra mã nhân viên cho những dòng đọc được, KỂ CẢ khi đã có lỗi cú pháp ở
     * dòng khác. Dừng sớm sẽ khiến HR sửa lỗi ngày tháng, nạp lại, rồi mới
     * phát hiện còn một mã nhân viên sai — đúng cái vòng lặp nhiều lượt mà
     * kiểu "tất cả hoặc không gì cả" sinh ra để tránh.
     */
    const resolved = await this.resolveEmployees(parsed.rows);
    const errors = [...parsed.errors, ...resolved.errors].sort(
      (left, right) => left.row - right.row,
    );

    if (errors.length > 0) {
      return {
        dryRun: options.dryRun,
        totalRows: parsed.totalRows,
        created: 0,
        updated: 0,
        errors,
      };
    }

    return this.applyRows(resolved.rows, parsed.totalRows, options.dryRun);
  }

  // ------------------------------------------------------------ đọc ----

  private async readWorkbook(
    file: UploadedFileLike | undefined,
  ): Promise<Workbook> {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException({
        code: 'IMPORT_FILE_REQUIRED',
        message:
          'Field "file" is required and must contain a non-empty .xlsx workbook',
      });
    }

    /*
     * .xlsx là một file ZIP, luôn bắt đầu bằng "PK\x03\x04". Kiểm magic bytes
     * chứ không tin phần mở rộng hay `mimetype` do client gửi — cùng nguyên tắc
     * với upload ảnh (PLAN §8.1). Không có bước này thì exceljs sẽ ném một lỗi
     * nội bộ khó hiểu và trả về 500 cho một file người dùng chọn nhầm.
     */
    const isZip =
      file.buffer.length >= 4 &&
      file.buffer[0] === 0x50 &&
      file.buffer[1] === 0x4b &&
      file.buffer[2] === 0x03 &&
      file.buffer[3] === 0x04;

    if (!isZip) {
      throw new BadRequestException({
        code: 'IMPORT_INVALID_FILE_TYPE',
        message: 'Uploaded file is not a valid .xlsx workbook',
      });
    }

    const workbook = new Workbook();

    try {
      // `as never`: exceljs khai báo tham số theo kiểu Buffer RIÊNG của nó,
      // không tương thích danh nghĩa với Buffer của Node dù runtime giống hệt.
      await workbook.xlsx.load(file.buffer as never);
    } catch {
      throw new BadRequestException({
        code: 'IMPORT_INVALID_FILE_TYPE',
        message: 'Uploaded workbook could not be parsed',
      });
    }

    return workbook;
  }

  /** Tiêu đề → chỉ số cột. Thiếu cột bắt buộc thì dừng ngay, không đọc dòng nào. */
  private resolveColumns(headerRow: Row): Record<string, number> {
    const found: Record<string, number> = {};

    headerRow.eachCell((cell, columnNumber) => {
      const normalised = foldForMatch(cellToString(cell.value));

      for (const [field, aliases] of Object.entries(
        AttendanceImportService.COLUMN_ALIASES,
      )) {
        if (found[field] === undefined && aliases.includes(normalised)) {
          found[field] = columnNumber;
        }
      }
    });

    const missing = ['employeeCode', 'workDate', 'checkIn'].filter(
      (field) => found[field] === undefined,
    );

    if (missing.length > 0) {
      throw new BadRequestException({
        code: 'IMPORT_MISSING_COLUMNS',
        message: `Workbook is missing required column(s): ${missing.join(', ')}. Expected headers: Mã NV, Ngày, Giờ vào, Giờ ra`,
      });
    }

    return found;
  }

  private parseRows(
    sheet: Workbook['worksheets'][number],
    columns: Record<string, number>,
  ): {
    rows: ParsedRow[];
    errors: AttendanceImportErrorDto[];
    totalRows: number;
  } {
    const rows: ParsedRow[] = [];
    const errors: AttendanceImportErrorDto[] = [];
    const seen = new Map<string, number>();
    let totalRows = 0;

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return; // tiêu đề
      }

      const employeeCode = cellToString(
        row.getCell(columns.employeeCode).value,
      ).trim();
      const rawDate = row.getCell(columns.workDate).value;
      const rawCheckIn = row.getCell(columns.checkIn).value;
      const rawCheckOut =
        columns.checkOut === undefined
          ? null
          : row.getCell(columns.checkOut).value;
      const rawBreakStart =
        columns.breakStart === undefined
          ? null
          : row.getCell(columns.breakStart).value;
      const rawBreakEnd =
        columns.breakEnd === undefined
          ? null
          : row.getCell(columns.breakEnd).value;
      const note =
        columns.note === undefined
          ? null
          : cellToString(row.getCell(columns.note).value).trim() || null;

      // Dòng trống hoàn toàn — bỏ qua im lặng. Excel hay để lại vài dòng rỗng
      // ở cuối sheet và báo lỗi cho chúng chỉ làm HR hoang mang.
      if (!employeeCode && !rawDate && !rawCheckIn) {
        return;
      }

      totalRows += 1;

      if (totalRows > AttendanceImportService.MAX_IMPORT_ROWS) {
        throw new BadRequestException({
          code: 'IMPORT_TOO_MANY_ROWS',
          message: `Workbook has more than ${AttendanceImportService.MAX_IMPORT_ROWS} data rows`,
        });
      }

      const push = (code: string, message: string): void => {
        errors.push({
          row: rowNumber,
          employeeCode: employeeCode || null,
          code,
          message,
        });
      };

      if (!employeeCode) {
        push('MISSING_EMPLOYEE_CODE', 'Thiếu mã nhân viên');
        return;
      }

      const workDate = parseDateCell(rawDate);

      if (!workDate) {
        push(
          'INVALID_DATE',
          `Ngày "${cellToString(rawDate)}" không hợp lệ — cần dạng ngày của Excel hoặc YYYY-MM-DD`,
        );
        return;
      }

      const checkIn = parseTimeCell(rawCheckIn);

      if (!checkIn) {
        push(
          'INVALID_TIME',
          `Giờ vào "${cellToString(rawCheckIn)}" không hợp lệ`,
        );
        return;
      }

      const checkOut = rawCheckOut === null ? null : parseTimeCell(rawCheckOut);

      if (
        rawCheckOut !== null &&
        cellToString(rawCheckOut).trim() !== '' &&
        !checkOut
      ) {
        push(
          'INVALID_TIME',
          `Giờ ra "${cellToString(rawCheckOut)}" không hợp lệ`,
        );
        return;
      }

      if (
        checkOut &&
        parseTimeToMinutes(checkOut) < parseTimeToMinutes(checkIn)
      ) {
        push(
          'INVALID_TIME',
          `Giờ ra "${checkOut}" sớm hơn giờ vào "${checkIn}"`,
        );
        return;
      }

      /*
       * Cột UNIQUE (employee_id, work_date) sẽ chặn ở DB, nhưng báo tại đây thì
       * HR biết CẢ HAI dòng nào đang đá nhau — lỗi từ DB chỉ nói "trùng".
       */
      const key = `${employeeCode}|${workDate}`;
      const firstRow = seen.get(key);

      if (firstRow !== undefined) {
        push(
          'DUPLICATE_ROW',
          `Trùng với dòng ${firstRow}: cùng nhân viên ${employeeCode} và cùng ngày ${workDate}`,
        );
        return;
      }

      /*
       * Giờ nghỉ chỉ được dùng khi CÓ ĐỦ CẢ HAI đầu. Một nửa khoảng thời gian
       * không ra được số phút nào, và đoán nốt nửa kia là bịa dữ liệu trả
       * lương — khi đó rơi về khung nghỉ chuẩn của công ty.
       */
      const breakStart = parseOptionalTime(rawBreakStart);
      const breakEnd = parseOptionalTime(rawBreakEnd);

      if (breakStart === INVALID || breakEnd === INVALID) {
        push(
          'INVALID_TIME',
          `Giờ nghỉ "${cellToString(rawBreakStart)} - ${cellToString(rawBreakEnd)}" không hợp lệ`,
        );
        return;
      }

      const hasBothBreakEnds = breakStart !== null && breakEnd !== null;

      if (
        hasBothBreakEnds &&
        parseTimeToMinutes(breakEnd) < parseTimeToMinutes(breakStart)
      ) {
        push(
          'INVALID_TIME',
          `Giờ kết thúc nghỉ "${breakEnd}" sớm hơn giờ bắt đầu nghỉ "${breakStart}"`,
        );
        return;
      }

      seen.set(key, rowNumber);
      rows.push({
        rowNumber,
        employeeCode,
        workDate,
        checkIn,
        checkOut,
        breakStart: hasBothBreakEnds ? breakStart : null,
        breakEnd: hasBothBreakEnds ? breakEnd : null,
        note,
      });
    });

    return { rows, errors, totalRows };
  }

  // -------------------------------------------------- tra cứu nhân viên ----

  /**
   * Đổi mã nhân viên thành id, tra MỘT LẦN cho cả file.
   *
   * Tra từng dòng sẽ là 20.000 truy vấn cho một file một tháng.
   */
  private async resolveEmployees(
    rows: ParsedRow[],
  ): Promise<{ rows: ResolvedRow[]; errors: AttendanceImportErrorDto[] }> {
    const codes = [...new Set(rows.map((row) => row.employeeCode))];
    const byCode = await this.employeesRepository.findIdsByEmployeeCodes(codes);

    const errors: AttendanceImportErrorDto[] = [];
    const resolved: ResolvedRow[] = [];

    for (const row of rows) {
      const employeeId = byCode.get(row.employeeCode);

      if (employeeId === undefined) {
        errors.push({
          row: row.rowNumber,
          employeeCode: row.employeeCode,
          code: 'EMPLOYEE_NOT_FOUND',
          message: `Không tìm thấy nhân viên đang làm việc có mã "${row.employeeCode}"`,
        });
        continue;
      }

      resolved.push({ ...row, employeeId });
    }

    return { rows: resolved, errors };
  }

  // ------------------------------------------------------------ ghi ----

  private async applyRows(
    rows: ResolvedRow[],
    totalRows: number,
    dryRun: boolean,
  ): Promise<AttendanceImportResultDto> {
    let created = 0;
    let updated = 0;
    const restDays = await this.resolveRestDays(rows);

    for (const row of rows) {
      const existing = await this.attendancesRepository.findByEmployeeAndDate(
        row.employeeId,
        row.workDate,
      );

      if (existing) {
        updated += 1;
      } else {
        created += 1;
      }

      if (dryRun) {
        continue;
      }

      const record = existing ?? emptyAttendance();
      record.employeeId = row.employeeId;
      record.workDate = row.workDate;
      this.applyTimes(
        record,
        row.checkIn,
        row.checkOut,
        restDays.has(row.workDate),
        row.breakStart,
        row.breakEnd,
      );
      record.note = row.note ?? record.note;

      await (existing
        ? this.attendancesRepository.save(record)
        : this.attendancesRepository.create(record));
    }

    this.logger.log(
      `Attendance import${dryRun ? ' (dry run)' : ''}: ${created} created, ${updated} overwritten, ${totalRows} rows read`,
    );

    return { dryRun, totalRows, created, updated, errors: [] };
  }

  /**
   * Dùng CHUNG một công thức với `AttendancesService` — nếu tính riêng ở đây
   * thì ngày công nhập từ file và ngày công tự chấm sẽ ra hai kết quả khác nhau
   * cho cùng một cặp giờ vào/ra.
   */
  /**
   * Tập các ngày trong file là ngày nghỉ (nghỉ hằng tuần hoặc nghỉ lễ).
   *
   * Tra bảng `holidays` MỘT LẦN cho mỗi năm xuất hiện trong file, không tra theo
   * từng dòng: một file 20.000 dòng sẽ thành 20.000 truy vấn cho cùng vài chục
   * ngày lễ. Dùng lại `resolveRateType()` để định nghĩa "ngày nghỉ" ở đây và ở
   * `AttendancesService` là một.
   */
  private async resolveRestDays(rows: ResolvedRow[]): Promise<Set<string>> {
    const years = new Set(rows.map((row) => Number(row.workDate.slice(0, 4))));
    const holidayDates = new Set<string>();

    for (const year of years) {
      const holidays = await this.holidaysService.findByYear(year);
      holidays.forEach((holiday) => holidayDates.add(holiday.holidayDate));
    }

    const restDays = new Set<string>();

    for (const row of rows) {
      if (
        resolveRateType(row.workDate, holidayDates.has(row.workDate)) !==
        OvertimeRateType.WEEKDAY
      ) {
        restDays.add(row.workDate);
      }
    }

    return restDays;
  }

  private applyTimes(
    record: Attendance,
    checkIn: string,
    checkOut: string | null,
    isRestDay: boolean,
    breakStart: string | null = null,
    breakEnd: string | null = null,
  ): void {
    record.breakStart = breakStart === null ? null : normaliseTime(breakStart);
    record.breakEnd = breakEnd === null ? null : normaliseTime(breakEnd);

    record.checkIn = normaliseTime(checkIn);

    if (!checkOut) {
      // Chưa có giờ ra thì giờ công là `null`, không phải 0 — giống hệt trường
      // hợp nhân viên chấm vào mà chưa chấm ra.
      record.checkOut = null;
      record.workHours = null;
      record.overtimeHours = '0.00';
      record.isEarlyLeave = false;
      record.earlyLeaveMinutes = 0;

      const arrival = calculateWorkHours({
        checkIn,
        checkOut: checkIn,
        isRestDay,
      });
      record.isLate = arrival.isLate;
      record.lateMinutes = arrival.lateMinutes;
      record.status = arrival.isLate
        ? AttendanceStatus.LATE
        : AttendanceStatus.PRESENT;
      return;
    }

    const computed = calculateWorkHours({
      checkIn,
      checkOut,
      breakStart,
      breakEnd,
      isRestDay,
    });

    record.checkOut = normaliseTime(checkOut);
    record.workHours = computed.workHours.toFixed(2);
    record.overtimeHours = computed.overtimeHours.toFixed(2);
    record.isLate = computed.isLate;
    record.lateMinutes = computed.lateMinutes;
    record.isEarlyLeave = computed.isEarlyLeave;
    record.earlyLeaveMinutes = computed.earlyLeaveMinutes;
    record.status = computed.isLate
      ? AttendanceStatus.LATE
      : computed.isEarlyLeave
        ? AttendanceStatus.EARLY_LEAVE
        : AttendanceStatus.PRESENT;
  }
}

interface ParsedRow {
  rowNumber: number;
  employeeCode: string;
  workDate: string;
  checkIn: string;
  checkOut: string | null;
  /** Giờ nghỉ thực tế; `null` = file không có, dùng khung nghỉ chuẩn. */
  breakStart: string | null;
  breakEnd: string | null;
  note: string | null;
}

interface ResolvedRow extends ParsedRow {
  employeeId: number;
}

/** Xem `newAttendance()` trong attendances.service.ts — cùng lý do. */
function emptyAttendance(): Attendance {
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

function normaliseTime(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}

/**
 * Ô Excel → chuỗi.
 *
 * `CellValue` của exceljs là một union rộng: chuỗi, số, `Date`, ô công thức
 * (`{ formula, result }`), rich text (`{ richText: [...] }`), hyperlink, lỗi.
 * Gọi thẳng `String(...)` lên nó sẽ cho ra `"[object Object]"` với ba dạng
 * cuối — tức là một mã nhân viên có định dạng màu sẽ đọc thành `[object
 * Object]` và cả dòng bị từ chối vì một lý do không liên quan tới dữ liệu.
 * Mỗi nhánh vì thế được bóc tách tường minh.
 */
function cellToString(value: CellValue): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('');
    }

    // Ô công thức: lấy KẾT QUẢ, không lấy công thức.
    if ('result' in value) {
      return cellToString(value.result);
    }

    if ('text' in value && typeof value.text === 'string') {
      return value.text;
    }

    // Ô lỗi (#N/A, #REF!...) — trả chuỗi rỗng để dòng bị bắt là "thiếu dữ
    // liệu" chứ không phải "dữ liệu lạ".
    return '';
  }

  return '';
}

/**
 * Ô ngày → `YYYY-MM-DD`.
 *
 * Nhận cả `Date` thật (Excel lưu ngày là số serial, exceljs đã đổi sẵn) lẫn
 * chuỗi. Chuỗi chấp nhận `YYYY-MM-DD` và `DD/MM/YYYY` — người Việt gõ tay gần
 * như luôn là dạng thứ hai, và đọc nhầm 03/04 thành 4 tháng 3 sẽ ghi công vào
 * đúng một ngày sai mà không ai nhận ra.
 */
function parseDateCell(value: CellValue): string | null {
  if (value instanceof Date) {
    // exceljs dựng Date ở mốc UTC cho ô ngày, đọc lại bằng getUTC* để không
    // lùi một ngày ở múi giờ +07.
    const pad = (part: number): string => `${part}`.padStart(2, '0');
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }

  const text = cellToString(value).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return assertRealDate(text.slice(0, 10));
  }

  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);

  if (dmy) {
    const [, day, month, year] = dmy;
    return assertRealDate(
      `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
    );
  }

  return null;
}

/** `2026-02-31` đúng cú pháp nhưng không tồn tại — MySQL sẽ từ chối, chặn sớm hơn. */
function assertRealDate(value: string): string | null {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return toDateOnlyString(date) === value ? value : null;
}

/**
 * Ô giờ → `HH:mm`.
 *
 * Excel lưu giờ là PHÂN SỐ CỦA MỘT NGÀY (0,5 = 12:00), và exceljs trả về nó
 * dưới dạng `Date` ở mốc 1899-12-31 hoặc dưới dạng số. Đọc số đó như một chuỗi
 * sẽ ra "0.3541666666666667" thay vì "08:30".
 */
function parseTimeCell(value: CellValue): string | null {
  if (value instanceof Date) {
    const pad = (part: number): string => `${part}`.padStart(2, '0');
    return `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`;
  }

  if (typeof value === 'number') {
    if (value < 0 || value >= 1) {
      return null;
    }
    return formatMinutesToTime(Math.round(value * 24 * 60));
  }

  const text = cellToString(value).trim();
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  return `${`${hours}`.padStart(2, '0')}:${`${minutes}`.padStart(2, '0')}`;
}

/**
 * Sentinel phân biệt "ô trống" với "ô có nội dung nhưng không đọc được".
 *
 * Trả `null` cho cả hai sẽ khiến một giờ nghỉ gõ sai bị bỏ qua lặng lẽ và ngày
 * đó âm thầm dùng khung nghỉ chuẩn — người nhập không bao giờ biết mình gõ sai.
 */
const INVALID = Symbol('invalid-time');

/** Ô giờ tuỳ chọn → `HH:mm`, `null` nếu trống, `INVALID` nếu có nội dung sai. */
function parseOptionalTime(value: CellValue): string | null | typeof INVALID {
  if (
    value === null ||
    value === undefined ||
    cellToString(value).trim() === ''
  ) {
    return null;
  }

  return parseTimeCell(value) ?? INVALID;
}

/** Bỏ dấu + hạ chữ thường để so khớp tiêu đề cột. */
function foldForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
