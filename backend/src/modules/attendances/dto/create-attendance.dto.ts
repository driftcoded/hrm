import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { IsCalendarDate } from '@/common/validators/is-calendar-date.validator';
import { IsClockTime } from '@/common/validators/is-clock-time.validator';
import { AttendanceStatus } from '../entities/attendance.entity';

/**
 * Body của `POST /attendances` — nhập tay MỘT ngày công.
 *
 * VÌ SAO CÓ ENDPOINT NÀY: hệ thống KHÔNG có chức năng nhân viên tự chấm công.
 * Dữ liệu chấm công đến từ nền tảng bên ngoài (máy chấm công / app riêng) và
 * được đưa vào đây bằng file Excel (`POST /attendances/bulk-import`) hoặc nhập
 * tay từng dòng qua endpoint này — dùng cho những trường hợp lẻ mà file không
 * có: nhân viên quên chấm, đi công tác, làm tại nhà.
 *
 * `checkIn` là TUỲ CHỌN: một ngày nghỉ phép hoặc ngày lễ vẫn là một dòng trong
 * bảng công, chỉ là không có giờ vào. Bắt buộc nó sẽ khiến người nhập phải bịa
 * ra một giờ cho ngày không ai đi làm.
 *
 * NHƯNG không có `checkIn` thì `status` thành BẮT BUỘC (service kiểm, trả
 * `ATTENDANCE_STATUS_REQUIRED`): thiếu cả hai thì bản ghi rơi về mặc định
 * `present` của cột, tức là một dòng nói người đó đi làm mà không có căn cứ nào.
 */
export class CreateAttendanceDto {
  @ApiProperty({ example: 51 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId: number;

  @ApiProperty({ example: '2026-05-25', description: 'YYYY-MM-DD' })
  @IsCalendarDate()
  workDate: string;

  @ApiPropertyOptional({ example: '08:00', description: 'Giờ vào, HH:mm' })
  @IsOptional()
  @IsClockTime()
  checkIn?: string;

  @ApiPropertyOptional({ example: '17:30', description: 'Giờ ra, HH:mm' })
  @IsOptional()
  @IsClockTime()
  checkOut?: string;

  @ApiPropertyOptional({
    example: '12:00',
    description:
      'Giờ nghỉ THỰC TẾ. Bỏ trống thì dùng khung nghỉ chuẩn của công ty (12:00–13:00). ' +
      'Muốn ghi "làm xuyên trưa" thì đặt hai giờ BẰNG NHAU — khác với bỏ trống, vốn có nghĩa "không rõ". ' +
      'Phải có ĐỦ CẢ HAI đầu mới được dùng.',
  })
  @IsOptional()
  @IsClockTime()
  breakStart?: string;

  @ApiPropertyOptional({
    example: '13:00',
    description: 'Giờ kết thúc nghỉ, HH:mm',
  })
  @IsOptional()
  @IsClockTime()
  breakEnd?: string;

  @ApiPropertyOptional({
    enum: AttendanceStatus,
    description:
      'Có giờ vào/ra thì bỏ trống được — trạng thái suy ra từ giờ. KHÔNG có giờ vào thì BẮT BUỘC (nghỉ phép, ngày lễ, làm từ xa, vắng).',
  })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @ApiPropertyOptional({
    example: 'Nhân viên quên chấm công',
    description: 'Ghi chú tuỳ chọn cho ngày công này.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
