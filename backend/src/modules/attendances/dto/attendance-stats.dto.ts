import { ApiProperty } from '@nestjs/swagger';
import { AttendanceStatus } from '../entities/attendance.entity';

/** Số bản ghi theo từng trạng thái; luôn có đủ mọi trạng thái, kể cả khi bằng 0. */
export class AttendanceStatusCountsDto {
  @ApiProperty({ example: 120 })
  present: number;

  @ApiProperty({ example: 3 })
  absent: number;

  @ApiProperty({ example: 8 })
  late: number;

  @ApiProperty({ example: 2 })
  early_leave: number;

  @ApiProperty({ example: 5 })
  leave: number;

  @ApiProperty({ example: 0 })
  holiday: number;

  @ApiProperty({ example: 4 })
  wfh: number;
}

/** Một ngày trong kỳ. */
export class AttendanceDailyStatDto {
  @ApiProperty({ example: '2026-05-25' })
  date: string;

  @ApiProperty({ type: AttendanceStatusCountsDto })
  counts: AttendanceStatusCountsDto;

  @ApiProperty({ example: 142, description: 'Tổng số bản ghi của ngày.' })
  total: number;
}

/**
 * Shape trả về của `GET /attendances/stats`.
 *
 * `daily` có đủ mọi ngày từ `from` tới `to`, kể cả ngày không có bản ghi nào.
 * `totals` là tổng của `daily`.
 */
export class AttendanceStatsDto {
  @ApiProperty({ example: '2026-05-01' })
  from: string;

  @ApiProperty({ example: '2026-05-31' })
  to: string;

  @ApiProperty({ type: AttendanceStatusCountsDto })
  totals: AttendanceStatusCountsDto;

  @ApiProperty({ example: 2840 })
  totalRecords: number;

  @ApiProperty({
    example: 65,
    description:
      'Số nhân viên còn làm việc trong phạm vi lọc. Là mẫu số của biểu đồ: ' +
      'ngày nào có ít bản ghi hơn số này thì phần chênh là ngày công chưa có dữ liệu.',
  })
  employeeCount: number;

  @ApiProperty({ example: 22720 })
  totalWorkHours: number;

  @ApiProperty({ example: 184.5 })
  totalOvertimeHours: number;

  @ApiProperty({ type: [AttendanceDailyStatDto] })
  daily: AttendanceDailyStatDto[];
}

/** Danh sách khoá trạng thái. */
const ATTENDANCE_STATUS_KEYS = Object.values(
  AttendanceStatus,
) as AttendanceStatus[];

/** Object đếm với đủ mọi trạng thái, tất cả bằng 0. */
export function emptyStatusCounts(): AttendanceStatusCountsDto {
  const counts = {} as AttendanceStatusCountsDto;

  for (const status of ATTENDANCE_STATUS_KEYS) {
    counts[status] = 0;
  }

  return counts;
}
