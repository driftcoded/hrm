import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Workbook } from 'exceljs';
import { EmployeesRepository } from '@/modules/employees/employees.repository';
import { UploadedFileLike } from '@/shared/storage/image-file.util';
import { AttendanceImportService } from './attendance-import.service';
import { AttendancesRepository } from './attendances.repository';
import { Attendance, AttendanceStatus } from './entities/attendance.entity';

type Cell = string | number | Date | null;

/** Dựng file .xlsx THẬT trong bộ nhớ — không mock exceljs. */
async function makeWorkbookFile(
  headers: string[],
  rows: Cell[][],
): Promise<UploadedFileLike> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Chấm công');
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));

  return {
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    originalname: 'cham-cong.xlsx',
    mimetype:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: 0,
  };
}

const HEADERS = ['Mã NV', 'Ngày', 'Giờ vào', 'Giờ ra', 'Ghi chú'];

/** Bộ tiêu đề có thêm hai cột giờ nghỉ. */
const HEADERS_WITH_BREAK = [
  'Mã NV',
  'Ngày',
  'Giờ vào',
  'Giờ ra',
  'Giờ nghỉ từ',
  'Giờ nghỉ đến',
  'Ghi chú',
];

async function captureError(
  run: () => Promise<unknown>,
): Promise<{ status: number; code: string }> {
  try {
    await run();
  } catch (error) {
    const exception = error as HttpException;
    const body = exception.getResponse() as { code: string };
    return { status: exception.getStatus(), code: body.code };
  }

  throw new Error('Expected the call to throw, but it resolved');
}

describe('AttendanceImportService', () => {
  let service: AttendanceImportService;
  let attendances: jest.Mocked<AttendancesRepository>;
  let employees: jest.Mocked<EmployeesRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceImportService,
        {
          provide: AttendancesRepository,
          useValue: {
            findByEmployeeAndDate: jest.fn().mockResolvedValue(null),
            create: jest.fn((record: Attendance) => Promise.resolve(record)),
            save: jest.fn((record: Attendance) => Promise.resolve(record)),
          },
        },
        {
          provide: EmployeesRepository,
          useValue: {
            findIdsByEmployeeCodes: jest.fn().mockResolvedValue(
              new Map([
                ['NV0001', 1],
                ['NV0002', 2],
              ]),
            ),
          },
        },
      ],
    }).compile();

    service = module.get(AttendanceImportService);
    attendances = module.get(AttendancesRepository);
    employees = module.get(EmployeesRepository);
  });

  describe('đọc file', () => {
    it('imports a well-formed sheet', async () => {
      const file = await makeWorkbookFile(HEADERS, [
        ['NV0001', '2026-05-04', '08:00', '17:30', ''],
        ['NV0002', '2026-05-04', '08:10', '17:00', 'Đi muộn'],
      ]);

      const result = await service.importFromFile(file, { dryRun: false });

      expect(result.errors).toEqual([]);
      expect(result.totalRows).toBe(2);
      expect(result.created).toBe(2);
      expect(attendances.create).toHaveBeenCalledTimes(2);
    });

    /* Cùng công thức với `AttendancesService` — nếu tính riêng, ngày công nhập
       từ file và ngày công tự chấm sẽ khác nhau cho cùng một cặp giờ. */
    it('computes 8.5 hours for 08:00-17:30, same as the check-out path', async () => {
      const file = await makeWorkbookFile(HEADERS, [
        ['NV0001', '2026-05-04', '08:00', '17:30', ''],
      ]);

      await service.importFromFile(file, { dryRun: false });

      expect(attendances.create).toHaveBeenCalledWith(
        expect.objectContaining({ workHours: '8.50', overtimeHours: '0.50' }),
      );
    });

    /* PLAN 4.1: chưa chấm ra thì giờ công là `null`, không phải 0. */
    it('leaves work hours null when the check-out column is blank', async () => {
      const file = await makeWorkbookFile(HEADERS, [
        ['NV0001', '2026-05-04', '08:10', '', 'Quên chấm ra'],
      ]);

      const result = await service.importFromFile(file, { dryRun: false });

      expect(result.errors).toEqual([]);
      expect(attendances.create).toHaveBeenCalledWith(
        expect.objectContaining({ checkOut: null, workHours: null }),
      );
    });

    /* Người Việt gõ tay gần như luôn là DD/MM/YYYY. Đọc nhầm 03/04 thành ngày
       4 tháng 3 sẽ ghi công vào đúng một ngày sai mà không ai nhận ra. */
    it('reads DD/MM/YYYY as day-first, not month-first', async () => {
      const file = await makeWorkbookFile(HEADERS, [
        ['NV0001', '03/04/2026', '08:00', '17:00', ''],
      ]);

      await service.importFromFile(file, { dryRun: false });

      expect(attendances.create).toHaveBeenCalledWith(
        expect.objectContaining({ workDate: '2026-04-03' }),
      );
    });

    it('reads a real Excel date cell', async () => {
      const file = await makeWorkbookFile(HEADERS, [
        ['NV0001', new Date(Date.UTC(2026, 4, 4)), '08:00', '17:00', ''],
      ]);

      await service.importFromFile(file, { dryRun: false });

      expect(attendances.create).toHaveBeenCalledWith(
        expect.objectContaining({ workDate: '2026-05-04' }),
      );
    });

    /*
     * Excel lưu giờ là PHÂN SỐ CỦA MỘT NGÀY. Đọc số đó như chuỗi cho ra
     * "0.3541666666666667" thay vì "08:30".
     */
    it('reads a numeric time cell as a fraction of a day', async () => {
      const file = await makeWorkbookFile(HEADERS, [
        ['NV0001', '2026-05-04', 8.5 / 24, 17 / 24, ''],
      ]);

      const result = await service.importFromFile(file, { dryRun: false });

      expect(result.errors).toEqual([]);
      expect(attendances.create).toHaveBeenCalledWith(
        expect.objectContaining({ checkIn: '08:30:00', checkOut: '17:00:00' }),
      );
    });

    it('matches column headers regardless of case and diacritics', async () => {
      const file = await makeWorkbookFile(
        ['MA NV', 'ngay', 'GIO VAO', 'gio ra', 'GHI CHU'],
        [['NV0001', '2026-05-04', '08:00', '17:00', '']],
      );

      const result = await service.importFromFile(file, { dryRun: false });

      expect(result.errors).toEqual([]);
      expect(result.created).toBe(1);
    });

    /* Excel hay để lại dòng rỗng ở cuối sheet; báo lỗi cho chúng chỉ gây hoang mang. */
    it('skips completely blank rows without reporting them', async () => {
      const file = await makeWorkbookFile(HEADERS, [
        ['NV0001', '2026-05-04', '08:00', '17:00', ''],
        [null, null, null, null, null],
      ]);

      const result = await service.importFromFile(file, { dryRun: false });

      expect(result.totalRows).toBe(1);
      expect(result.errors).toEqual([]);
    });
  });

  describe('giờ nghỉ', () => {
    /*
     * Không có cột nghỉ thì hệ thống dùng khung nghỉ chuẩn 12:00–13:00. Đây là
     * hành vi cũ và phải giữ nguyên: phần lớn máy chấm công chỉ ghi vào/ra.
     */
    it('falls back to the standard break when the file has no break columns', async () => {
      const file = await makeWorkbookFile(HEADERS, [
        ['NV0001', '2026-05-04', '08:00', '17:00', ''],
      ]);

      await service.importFromFile(file, { dryRun: false });

      expect(attendances.create).toHaveBeenCalledWith(
        expect.objectContaining({
          breakStart: null,
          breakEnd: null,
          workHours: '8.00',
        }),
      );
    });

    it('deducts the real break when the file provides one', async () => {
      const file = await makeWorkbookFile(HEADERS_WITH_BREAK, [
        ['NV0001', '2026-05-04', '08:00', '17:00', '12:00', '12:30', ''],
      ]);

      await service.importFromFile(file, { dryRun: false });

      expect(attendances.create).toHaveBeenCalledWith(
        expect.objectContaining({
          breakStart: '12:00:00',
          breakEnd: '12:30:00',
          workHours: '8.50',
        }),
      );
    });

    /* Khoảng nghỉ rỗng thì không có gì để trừ — file nói nghỉ 0 phút. */
    it('deducts nothing when the file gives an empty break range', async () => {
      const file = await makeWorkbookFile(HEADERS_WITH_BREAK, [
        ['NV0001', '2026-05-04', '08:00', '17:00', '12:00', '12:00', ''],
      ]);

      await service.importFromFile(file, { dryRun: false });

      expect(attendances.create).toHaveBeenCalledWith(
        expect.objectContaining({ workHours: '9.00' }),
      );
    });

    /* Một nửa khoảng thời gian không ra được số phút nào → dùng khung chuẩn. */
    it('ignores a break with only one end filled in', async () => {
      const file = await makeWorkbookFile(HEADERS_WITH_BREAK, [
        ['NV0001', '2026-05-04', '08:00', '17:00', '12:00', '', ''],
      ]);

      const result = await service.importFromFile(file, { dryRun: false });

      expect(result.errors).toEqual([]);
      expect(attendances.create).toHaveBeenCalledWith(
        expect.objectContaining({ breakStart: null, workHours: '8.00' }),
      );
    });

    it('rejects a reversed break instead of adding hours', async () => {
      const file = await makeWorkbookFile(HEADERS_WITH_BREAK, [
        ['NV0001', '2026-05-04', '08:00', '17:00', '13:00', '12:00', ''],
      ]);

      const result = await service.importFromFile(file, { dryRun: false });

      expect(result.errors[0].code).toBe('INVALID_TIME');
      expect(attendances.create).not.toHaveBeenCalled();
    });

    /*
     * Giờ nghỉ gõ sai phải BÁO LỖI, không được im lặng rơi về khung chuẩn —
     * người nhập sẽ không bao giờ biết mình gõ sai.
     */
    it('reports a malformed break rather than silently ignoring it', async () => {
      const file = await makeWorkbookFile(HEADERS_WITH_BREAK, [
        ['NV0001', '2026-05-04', '08:00', '17:00', '99:99', '13:00', ''],
      ]);

      const result = await service.importFromFile(file, { dryRun: false });

      expect(result.errors[0].code).toBe('INVALID_TIME');
    });
  });

  describe('từ chối file hỏng', () => {
    it('rejects a missing file', async () => {
      const error = await captureError(() =>
        service.importFromFile(undefined, { dryRun: false }),
      );

      expect(error).toEqual({ status: 400, code: 'IMPORT_FILE_REQUIRED' });
    });

    /* .xlsx là ZIP: kiểm magic bytes, không tin phần mở rộng do client gửi. */
    it('rejects a file that is not a real xlsx, by magic bytes', async () => {
      const error = await captureError(() =>
        service.importFromFile(
          {
            buffer: Buffer.from('day khong phai file excel'),
            originalname: 'gia-mao.xlsx',
            mimetype:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            size: 25,
          },
          { dryRun: false },
        ),
      );

      expect(error).toEqual({ status: 400, code: 'IMPORT_INVALID_FILE_TYPE' });
    });

    it('rejects a sheet missing a required column', async () => {
      const file = await makeWorkbookFile(
        ['Mã NV', 'Giờ vào'],
        [['NV0001', '08:00']],
      );

      const error = await captureError(() =>
        service.importFromFile(file, { dryRun: false }),
      );

      expect(error).toEqual({ status: 400, code: 'IMPORT_MISSING_COLUMNS' });
    });
  });

  describe('tất cả hoặc không gì cả', () => {
    /*
     * Nhập một phần để lại một tháng công nửa vời mà HR phải tự dò xem thiếu
     * ai — và bảng công thiếu ngày trông y hệt bảng công đủ.
     */
    it('writes nothing at all when a single row is invalid', async () => {
      const file = await makeWorkbookFile(HEADERS, [
        ['NV0001', '2026-05-04', '08:00', '17:00', ''],
        ['NV0002', '2026-05-04', '08:00', '07:00', ''],
        ['NV0001', '2026-05-05', '08:00', '17:00', ''],
      ]);

      const result = await service.importFromFile(file, { dryRun: false });

      expect(result.errors).toHaveLength(1);
      expect(result.created).toBe(0);
      expect(attendances.create).not.toHaveBeenCalled();
      expect(attendances.save).not.toHaveBeenCalled();
    });

    it('reports every bad row at once, with its Excel row number', async () => {
      const file = await makeWorkbookFile(HEADERS, [
        ['NV0001', 'khong-phai-ngay', '08:00', '17:00', ''],
        ['NV0002', '2026-05-04', '99:99', '17:00', ''],
      ]);

      const result = await service.importFromFile(file, { dryRun: false });

      expect(result.errors).toHaveLength(2);
      // Dòng 1 là tiêu đề, nên hai dòng dữ liệu là 2 và 3.
      expect(result.errors.map((error) => error.row)).toEqual([2, 3]);
      expect(result.errors.map((error) => error.code)).toEqual([
        'INVALID_DATE',
        'INVALID_TIME',
      ]);
    });

    it('flags a check-out earlier than the check-in', async () => {
      const file = await makeWorkbookFile(HEADERS, [
        ['NV0001', '2026-05-04', '17:00', '08:00', ''],
      ]);

      const result = await service.importFromFile(file, { dryRun: false });

      expect(result.errors[0].code).toBe('INVALID_TIME');
    });

    /* Cột UNIQUE sẽ chặn ở DB, nhưng lỗi từ DB chỉ nói "trùng" — báo tại đây
       thì HR biết CẢ HAI dòng nào đang đá nhau. */
    it('names both rows when the same employee and date appear twice', async () => {
      const file = await makeWorkbookFile(HEADERS, [
        ['NV0001', '2026-05-04', '08:00', '17:00', ''],
        ['NV0001', '2026-05-04', '09:00', '18:00', ''],
      ]);

      const result = await service.importFromFile(file, { dryRun: false });

      expect(result.errors[0].code).toBe('DUPLICATE_ROW');
      expect(result.errors[0].row).toBe(3);
      expect(result.errors[0].message).toContain('dòng 2');
    });

    /*
     * Lỗi cú pháp và lỗi "không có mã này" phải về CÙNG MỘT LƯỢT. Dừng sau
     * nhóm lỗi đầu tiên là bắt HR nạp lại nhiều lần — đúng cái mà kiểu "tất cả
     * hoặc không gì cả" sinh ra để tránh.
     */
    it('reports parse errors and unknown employees together, sorted by row', async () => {
      const file = await makeWorkbookFile(HEADERS, [
        ['NV0001', 'khong-phai-ngay', '08:00', '17:00', ''],
        ['NV9999', '2026-05-04', '08:00', '17:00', ''],
      ]);

      const result = await service.importFromFile(file, { dryRun: false });

      expect(result.errors.map((error) => [error.row, error.code])).toEqual([
        [2, 'INVALID_DATE'],
        [3, 'EMPLOYEE_NOT_FOUND'],
      ]);
    });

    it('rejects an unknown employee code', async () => {
      const file = await makeWorkbookFile(HEADERS, [
        ['NV9999', '2026-05-04', '08:00', '17:00', ''],
      ]);

      const result = await service.importFromFile(file, { dryRun: false });

      expect(result.errors[0].code).toBe('EMPLOYEE_NOT_FOUND');
      expect(result.created).toBe(0);
    });

    /* Một truy vấn cho cả file, không phải một truy vấn mỗi dòng. */
    it('resolves all employee codes in a single query', async () => {
      const file = await makeWorkbookFile(HEADERS, [
        ['NV0001', '2026-05-04', '08:00', '17:00', ''],
        ['NV0002', '2026-05-04', '08:00', '17:00', ''],
        ['NV0001', '2026-05-05', '08:00', '17:00', ''],
      ]);

      await service.importFromFile(file, { dryRun: false });

      expect(employees.findIdsByEmployeeCodes).toHaveBeenCalledTimes(1);
      expect(employees.findIdsByEmployeeCodes).toHaveBeenCalledWith([
        'NV0001',
        'NV0002',
      ]);
    });
  });

  describe('dryRun', () => {
    it('reports what would happen without writing anything', async () => {
      const file = await makeWorkbookFile(HEADERS, [
        ['NV0001', '2026-05-04', '08:00', '17:00', ''],
      ]);

      const result = await service.importFromFile(file, { dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.created).toBe(1);
      expect(attendances.create).not.toHaveBeenCalled();
      expect(attendances.save).not.toHaveBeenCalled();
    });
  });

  describe('ghi đè dữ liệu cũ', () => {
    /*
     * File máy chấm công thường được nạp lại sau khi sửa, nên ghi đè là đúng —
     * nhưng số bản ghi bị đè phải được báo về, để không ai vô tình thay đổi
     * ngày công đã chốt mà không biết.
     */
    it('counts overwrites separately from new records', async () => {
      attendances.findByEmployeeAndDate.mockImplementation(
        (employeeId: number) =>
          Promise.resolve(employeeId === 1 ? ({ id: 5 } as Attendance) : null),
      );

      const file = await makeWorkbookFile(HEADERS, [
        ['NV0001', '2026-05-04', '08:00', '17:00', ''],
        ['NV0002', '2026-05-04', '08:00', '17:00', ''],
      ]);

      const result = await service.importFromFile(file, { dryRun: false });

      expect(result.created).toBe(1);
      expect(result.updated).toBe(1);
      expect(attendances.save).toHaveBeenCalledTimes(1);
      expect(attendances.create).toHaveBeenCalledTimes(1);
    });

    it('reports overwrites during a dry run too, before anything is written', async () => {
      attendances.findByEmployeeAndDate.mockResolvedValue({
        id: 5,
      } as Attendance);

      const file = await makeWorkbookFile(HEADERS, [
        ['NV0001', '2026-05-04', '08:00', '17:00', ''],
      ]);

      const result = await service.importFromFile(file, { dryRun: true });

      expect(result.updated).toBe(1);
      expect(attendances.save).not.toHaveBeenCalled();
    });
  });

  describe('trạng thái suy ra', () => {
    it('marks an arrival more than 15 minutes late', async () => {
      const file = await makeWorkbookFile(HEADERS, [
        ['NV0001', '2026-05-04', '08:20', '17:00', ''],
      ]);

      await service.importFromFile(file, { dryRun: false });

      expect(attendances.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isLate: true,
          lateMinutes: 20,
          status: AttendanceStatus.LATE,
        }),
      );
    });

    it('marks leaving early', async () => {
      const file = await makeWorkbookFile(HEADERS, [
        ['NV0001', '2026-05-04', '08:00', '16:00', ''],
      ]);

      await service.importFromFile(file, { dryRun: false });

      expect(attendances.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: AttendanceStatus.EARLY_LEAVE }),
      );
    });
  });
});
