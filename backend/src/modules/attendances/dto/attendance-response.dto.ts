import { ApiProperty } from '@nestjs/swagger';
import { AttendanceStatus } from '../entities/attendance.entity';

/** Nhân viên rút gọn nhúng trong response chấm công. */
export class AttendanceEmployeeDto {
  @ApiProperty({ example: 51 })
  id: number;

  @ApiProperty({ example: 'NV0051' })
  employeeCode: string;

  @ApiProperty({ example: 'Nguyễn Văn Bình' })
  fullName: string;

  @ApiProperty({ example: 'Phòng Kỹ thuật', nullable: true, type: String })
  departmentName: string | null;
}

/**
 * Shape trả về của `/attendances` (api-spec.md §7).
 *
 * Giờ trả về dạng `HH:mm` chứ không phải `HH:mm:ss` của cột `TIME`: bảng chấm
 * công đọc theo phút, phần giây chỉ là nhiễu trên màn hình.
 *
 * Các cột `DECIMAL` trả về dạng `number` (api-spec.md §1.5) — mysql2 trả chuỗi
 * nên phải ép ở tầng service.
 */
export class AttendanceResponseDto {
  @ApiProperty({ example: 1001 })
  id: number;

  @ApiProperty({ example: 51 })
  employeeId: number;

  @ApiProperty({ type: AttendanceEmployeeDto, nullable: true })
  employee: AttendanceEmployeeDto | null;

  @ApiProperty({ example: '2026-05-25' })
  workDate: string;

  @ApiProperty({ example: '08:05', nullable: true, type: String })
  checkIn: string | null;

  @ApiProperty({ example: '17:30', nullable: true, type: String })
  checkOut: string | null;

  @ApiProperty({
    example: 8.5,
    nullable: true,
    type: Number,
    description: 'Giờ công đã trừ nghỉ trưa. `null` khi chưa chấm ra.',
  })
  workHours: number | null;

  @ApiProperty({
    example: 0.5,
    description:
      'Số giờ đã làm VƯỢT ngày công chuẩn. Đây là dữ kiện thực tế, KHÔNG phải căn cứ trả tiền làm thêm — tiền tính theo đơn tại `/overtime-requests` đã duyệt.',
  })
  overtimeHours: number;

  @ApiProperty({ example: false })
  isLate: boolean;

  @ApiProperty({ example: 0 })
  lateMinutes: number;

  @ApiProperty({ example: false })
  isEarlyLeave: boolean;

  @ApiProperty({ example: 0 })
  earlyLeaveMinutes: number;

  @ApiProperty({ enum: AttendanceStatus })
  status: AttendanceStatus;

  @ApiProperty({ example: null, nullable: true, type: String })
  note: string | null;

  @ApiProperty({ example: '2026-05-25T01:05:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-05-25T10:30:00.000Z' })
  updatedAt: string;
}

/** Tổng hợp chấm công một tháng (api-spec.md §7 – `GET /attendances/me`). */
export class AttendanceSummaryDto {
  @ApiProperty({
    example: 22,
    description:
      'Số ngày làm việc theo lịch trong tháng: trừ Thứ Bảy, Chủ nhật và ngày lễ chính thức.',
  })
  workingDays: number;

  @ApiProperty({ example: 20, description: 'Số ngày có chấm công đi làm.' })
  presentDays: number;

  @ApiProperty({
    example: 1,
    description:
      'Số ngày làm việc KHÔNG có bản ghi chấm công và cũng không có đơn nghỉ. Chỉ đếm tới hôm nay — những ngày còn lại của tháng chưa xảy ra nên không thể vắng.',
  })
  absentDays: number;

  @ApiProperty({ example: 1 })
  lateDays: number;

  @ApiProperty({ example: 0 })
  earlyLeaveDays: number;

  @ApiProperty({ example: 1, description: 'Số ngày nghỉ có đơn đã duyệt.' })
  leaveDays: number;

  @ApiProperty({ example: 168.5, description: 'Tổng giờ công trong tháng.' })
  totalWorkHours: number;

  @ApiProperty({
    example: 4.5,
    description:
      'Tổng giờ đã làm vượt ngày công chuẩn — dữ kiện thực tế, không phải giờ được trả tiền làm thêm.',
  })
  overtimeHours: number;

  @ApiProperty({
    example: 4,
    description:
      'Tổng giờ làm thêm ĐÃ ĐƯỢC DUYỆT — đây mới là căn cứ trả tiền.',
  })
  approvedOvertimeHours: number;
}

/** Response của `GET /attendances/me`. */
export class MyAttendanceResponseDto {
  @ApiProperty({ example: 5 })
  month: number;

  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ type: AttendanceSummaryDto })
  summary: AttendanceSummaryDto;

  @ApiProperty({ type: [AttendanceResponseDto] })
  records: AttendanceResponseDto[];
}
