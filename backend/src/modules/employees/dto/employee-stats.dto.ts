import { ApiProperty } from '@nestjs/swagger';
import { EmployeeStatus } from '../entities/employee.entity';

/** Một lát của biểu đồ tròn "Tổng quan nhân sự" theo phòng ban. */
export class DepartmentHeadcountDto {
  @ApiProperty({ example: 2 })
  departmentId: number;

  @ApiProperty({ example: 'Phòng Kỹ thuật' })
  departmentName: string;

  @ApiProperty({ example: 72 })
  count: number;
}

/** Một người trong danh sách "Sinh nhật sắp tới". */
export class UpcomingBirthdayDto {
  @ApiProperty({ example: 4 })
  employeeId: number;

  @ApiProperty({ example: 'NV0004' })
  employeeCode: string;

  @ApiProperty({ example: 'Phạm Thị Lan' })
  fullName: string;

  @ApiProperty({ example: null, nullable: true, type: String })
  avatarUrl: string | null;

  @ApiProperty({ example: '05-25', description: 'Ngày sinh dạng `MM-DD`' })
  birthday: string;

  @ApiProperty({ example: 2, description: '0 = hôm nay' })
  daysUntil: number;
}

/**
 * `GET /employees/stats` — số liệu cho các thẻ tổng quan + panel bên phải của
 * màn hình `/employees`.
 *
 * Gộp vào MỘT endpoint thay vì để frontend tự đếm bằng nhiều lời gọi
 * `GET /employees?status=…`: mỗi con số ở đây là một `COUNT` chạy trên toàn
 * bảng, không phải trên một trang 20 dòng, nên đếm ở client vừa sai vừa tốn
 * 6-7 request cho một lần mở trang.
 *
 * ⚠️ CỐ Ý KHÔNG có trường "so với tháng trước". Bảng `employees` chỉ lưu TRẠNG
 * THÁI HIỆN TẠI (`status`, `probation_end_date`…), không lưu lịch sử thay đổi,
 * nên không thể tính trung thực số nhân viên thử việc / đang nghỉ phép của
 * tháng trước. Chỉ `hiredLast30Days` là suy ra được thật từ `hire_date`. Muốn
 * có delta đầy đủ thì phải đọc bảng `work_history` (Giai đoạn 7+).
 */
export class EmployeeStatsDto {
  @ApiProperty({ example: 256, description: 'Tổng nhân viên chưa xoá mềm' })
  total: number;

  @ApiProperty({
    example: { probation: 18, active: 210, on_leave: 25 },
    description: 'Số nhân viên theo từng giá trị của `employees.status`',
    additionalProperties: { type: 'number' },
  })
  byStatus: Record<EmployeeStatus, number>;

  @ApiProperty({
    example: 11,
    description: 'Hợp đồng `active` có `end_date` trong N ngày tới',
  })
  contractsExpiringSoon: number;

  @ApiProperty({
    example: 30,
    description: 'Số ngày dùng cho contractsExpiringSoon và upcomingBirthdays',
  })
  windowDays: number;

  @ApiProperty({
    example: 12,
    description:
      'Nhân viên có `hire_date` trong 30 ngày qua — con số duy nhất suy ra được trung thực từ dữ liệu hiện có',
  })
  hiredLast30Days: number;

  @ApiProperty({
    example: 7,
    description: 'Nhân viên có `probation_end_date` trong N ngày tới',
  })
  probationEndingSoon: number;

  @ApiProperty({ example: { male: 156, female: 100, other: 0 } })
  byGender: { male: number; female: number; other: number };

  @ApiProperty({
    example: 29.4,
    nullable: true,
    type: Number,
    description:
      'Tuổi trung bình, làm tròn 1 chữ số. null khi chưa có nhân viên',
  })
  averageAge: number | null;

  @ApiProperty({
    example: 2.1,
    nullable: true,
    type: Number,
    description: 'Thâm niên trung bình (năm), làm tròn 1 chữ số',
  })
  averageTenureYears: number | null;

  @ApiProperty({ type: [DepartmentHeadcountDto] })
  byDepartment: DepartmentHeadcountDto[];

  @ApiProperty({ type: [UpcomingBirthdayDto] })
  upcomingBirthdays: UpcomingBirthdayDto[];
}
