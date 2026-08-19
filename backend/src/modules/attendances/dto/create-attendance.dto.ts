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
    enum: AttendanceStatus,
    description:
      'Bỏ trống thì trạng thái được tính từ giờ vào/ra. Đặt tường minh cho các ngày máy không biết: `wfh`, `leave`, `holiday`.',
  })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @ApiProperty({
    example: 'Nhân viên quên chấm công, xác nhận bởi trưởng phòng',
    description:
      'BẮT BUỘC — một dòng nhập tay phải nói được nó đến từ đâu, vì nó không có bằng chứng từ máy chấm công.',
    minLength: 3,
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  note: string;
}
