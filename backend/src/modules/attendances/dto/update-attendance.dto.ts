import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsClockTime } from '@/common/validators/is-clock-time.validator';
import { AttendanceStatus } from '../entities/attendance.entity';

/**
 * Body của `PATCH /attendances/:id` — HR điều chỉnh khi máy chấm công lỗi hoặc
 * nhân viên quên chấm (api-spec.md §7).
 *
 * `note` là BẮT BUỘC dù mọi trường khác đều tuỳ chọn. Sửa bảng chấm công là
 * sửa căn cứ trả lương của một con người; bản ghi sau khi sửa phải tự nói được
 * vì sao nó khác với thứ máy ghi. Một bảng công có ô bị đổi mà không ai biết
 * lý do thì đến kỳ đối chiếu lương không ai bảo vệ được con số đó.
 *
 * KHÔNG cho sửa `workDate` và `employeeId`: đổi hai trường đó không phải là
 * "điều chỉnh" mà là chuyển bản ghi sang một ngày/một người khác — việc đó phải
 * là xoá và tạo lại, để lịch sử không bị viết lại lặng lẽ.
 */
export class UpdateAttendanceDto {
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
      'Giờ nghỉ thực tế. Hai giờ bằng nhau = làm xuyên trưa; bỏ trống = giữ nguyên giá trị đang có.',
  })
  @IsOptional()
  @IsClockTime()
  breakStart?: string;

  @ApiPropertyOptional({ example: '13:00' })
  @IsOptional()
  @IsClockTime()
  breakEnd?: string;

  @ApiPropertyOptional({
    enum: AttendanceStatus,
    description:
      'Đặt trạng thái thủ công (ví dụ `wfh`). Bỏ trống thì trạng thái được tính lại từ giờ vào/ra.',
  })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @ApiPropertyOptional({
    required: true,
    example: 'Điều chỉnh do máy chấm công lỗi',
    description: 'BẮT BUỘC — lý do điều chỉnh, lưu vào bản ghi.',
    minLength: 3,
    maxLength: 500,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  note: string;
}
