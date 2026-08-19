import { ApiProperty } from '@nestjs/swagger';
import {
  LeaveHalf,
  LeaveRequestStatus,
} from '@/modules/leaves/entities/leave-request.entity';

/** Nhân viên rút gọn nhúng trong response đơn nghỉ. */
export class LeaveRequestEmployeeDto {
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
export class LeaveRequestTypeDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'ANNUAL' })
  code: string;

  @ApiProperty({ example: 'Nghỉ phép năm' })
  name: string;

  @ApiProperty({ example: true, description: 'Nghỉ có hưởng lương hay không.' })
  isPaid: boolean;
}

/** Shape trả về của `/leave-requests`. */
export class LeaveRequestResponseDto {
  @ApiProperty({ example: 33 })
  id: number;

  @ApiProperty({ example: 51 })
  employeeId: number;

  @ApiProperty({ type: LeaveRequestEmployeeDto, nullable: true })
  employee: LeaveRequestEmployeeDto | null;

  @ApiProperty({ type: LeaveRequestTypeDto, nullable: true })
  leaveType: LeaveRequestTypeDto | null;

  @ApiProperty({ example: '2026-05-04' })
  startDate: string;

  @ApiProperty({ example: '2026-05-08' })
  endDate: string;

  @ApiProperty({ enum: LeaveHalf })
  startHalf: LeaveHalf;

  @ApiProperty({ enum: LeaveHalf })
  endHalf: LeaveHalf;

  @ApiProperty({
    example: 4.5,
    description:
      'Số ngày phép bị trừ — do server tính, chỉ đếm ngày làm việc (bỏ T7/CN và ngày lễ).',
  })
  totalDays: number;

  @ApiProperty({ example: 'Nghỉ phép năm về quê' })
  reason: string;

  @ApiProperty({
    example: 12,
    nullable: true,
    type: Number,
    description: 'Người GHI NHẬN đơn. `null` với đơn tạo trước khi có cột này.',
  })
  recordedBy: number | null;

  @ApiProperty({ example: 'Lê Văn Trưởng Nhóm', nullable: true, type: String })
  recorderName: string | null;

  @ApiProperty({ enum: LeaveRequestStatus })
  status: LeaveRequestStatus;

  @ApiProperty({ example: null, nullable: true, type: Number })
  approvedBy: number | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  approverName: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  approvedAt: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  rejectedReason: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  attachmentUrl: string | null;

  @ApiProperty({ example: '2026-04-20T02:10:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-04-21T03:00:00.000Z' })
  updatedAt: string;
}

/** Kết quả duyệt đơn — kèm những ngày KHÔNG ghi được vào bảng chấm công. */
export class ApproveLeaveRequestResultDto {
  @ApiProperty({ type: LeaveRequestResponseDto })
  request: LeaveRequestResponseDto;

  @ApiProperty({
    example: 3,
    description:
      'Số ngày công được ghi vào bảng chấm công với trạng thái `leave`.',
  })
  attendanceDaysWritten: number;

  @ApiProperty({
    example: ['2026-05-06'],
    type: [String],
    description:
      'Những ngày ĐÃ CÓ dữ liệu chấm công nên KHÔNG bị ghi đè. Nhân viên vừa nghỉ phép vừa có giờ chấm công là mâu thuẫn cần người xem, không phải thứ để phần mềm tự quyết.',
  })
  attendanceConflicts: string[];
}

/**
 * Kết quả `DELETE /leave-requests/:id`.
 *
 * Xoá một đơn ĐÃ DUYỆT phải gỡ luôn những ngày `leave` mà lúc duyệt nó đã ghi
 * vào bảng chấm công — hai con số dưới đây nói rõ đã gỡ được bao nhiêu và giữ
 * lại bao nhiêu, để người xoá không phải tự đi dò bảng công.
 */
export class DeleteLeaveRequestResultDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: true })
  deleted: boolean;

  @ApiProperty({
    example: 3,
    description: 'Số dòng chấm công `leave` do đơn này sinh ra và đã được gỡ.',
  })
  attendanceDaysRemoved: number;

  @ApiProperty({
    example: 1,
    description:
      'Số dòng chấm công của đơn này nhưng ĐÃ BỊ SỬA sang trạng thái khác (nhập tay hoặc nạp từ máy chấm công) nên được GIỮ LẠI. Đó là dữ liệu công thật, xoá đi là mất.',
  })
  attendanceDaysKept: number;
}
