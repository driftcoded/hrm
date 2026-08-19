import { ApiProperty } from '@nestjs/swagger';

/** Nhân viên rút gọn nhúng trong response quỹ phép. */
export class LeaveBalanceEmployeeDto {
  @ApiProperty({ example: 51 })
  id: number;

  @ApiProperty({ example: 'NV0051' })
  employeeCode: string;

  @ApiProperty({ example: 'Nguyễn Văn Bình' })
  fullName: string;

  @ApiProperty({ example: 'Phòng Kỹ thuật', nullable: true, type: String })
  departmentName: string | null;
}

/** Loại nghỉ phép rút gọn. */
export class LeaveBalanceTypeDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'ANNUAL' })
  code: string;

  @ApiProperty({ example: 'Nghỉ phép năm' })
  name: string;
}

/**
 * Shape trả về của `/leave-balances`.
 *
 * Mọi cột `DECIMAL` trả về dạng `number` (api-spec.md §1.5) — mysql2 trả chuỗi
 * nên phải ép ở tầng service.
 */
export class LeaveBalanceResponseDto {
  @ApiProperty({ example: 88 })
  id: number;

  @ApiProperty({ example: 51 })
  employeeId: number;

  @ApiProperty({ type: LeaveBalanceEmployeeDto, nullable: true })
  employee: LeaveBalanceEmployeeDto | null;

  @ApiProperty({ type: LeaveBalanceTypeDto, nullable: true })
  leaveType: LeaveBalanceTypeDto | null;

  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ example: 12, description: 'Số ngày được cấp cho năm nay.' })
  allocatedDays: number;

  @ApiProperty({ example: 2, description: 'Chuyển từ năm trước sang.' })
  carriedOver: number;

  @ApiProperty({ example: 3, description: 'Đã dùng — từ các đơn ĐÃ DUYỆT.' })
  usedDays: number;

  @ApiProperty({
    example: 1,
    description: 'Đang chờ duyệt — đã giữ chỗ nhưng chưa trừ hẳn.',
  })
  pendingDays: number;

  @ApiProperty({
    example: 10,
    description:
      'Cột VIRTUAL của DB: `allocated + carried_over − used − pending`. Chỉ đọc.',
  })
  remainingDays: number;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt: string;
}

/** Kết quả `POST /leave-balances/init`. */
export class InitLeaveBalanceResultDto {
  @ApiProperty({ example: false })
  dryRun: boolean;

  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({
    example: 68,
    description: 'Số nhân viên đang làm việc được xét.',
  })
  employeesConsidered: number;

  @ApiProperty({ example: 62, description: 'Số quỹ phép được tạo mới.' })
  created: number;

  @ApiProperty({
    example: 6,
    description:
      'Số người ĐÃ CÓ quỹ phép năm này nên bị bỏ qua. KHÔNG ghi đè — quỹ đang dùng có thể đã bị trừ bởi các đơn đã duyệt.',
  })
  skipped: number;
}
