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
    example: '12:00',
    nullable: true,
    type: String,
    description:
      'Giờ nghỉ thực tế. `null` = không rõ, khi đó giờ công được tính theo khung nghỉ chuẩn của công ty.',
  })
  breakStart: string | null;

  @ApiProperty({ example: '13:00', nullable: true, type: String })
  breakEnd: string | null;

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
      'Số giờ VƯỢT ngày công chuẩn, suy ra từ giờ vào/ra. KHÔNG phải căn cứ trả tiền làm thêm — tiền tính theo đơn đã duyệt tại `/overtime-requests`.',
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
