import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { IsCalendarDate } from '@/common/validators/is-calendar-date.validator';
import { IsClockTime } from '@/common/validators/is-clock-time.validator';

/**
 * Body của `POST /overtime-requests` — quản lý/nhân sự GHI NHẬN giờ làm thêm
 * cho một nhân viên.
 *
 * `employeeId` là BẮT BUỘC và là người ĐƯỢC hưởng giờ làm thêm, không phải
 * người gửi request: nhân viên không đăng nhập hệ thống này. Người gửi được
 * ghi vào `recorded_by` từ token, không lấy từ body — để không ai ghi hộ dưới
 * tên người khác.
 *
 * KHÔNG nhận số giờ, hệ số hay loại ngày: cả ba đều SUY RA từ ngày và khung giờ
 * (`overtime.util.ts`). Cho client gửi lên là cho phép khai 8 giờ cho một ca
 * 2 tiếng, hoặc tự chọn hệ số ngày lễ cho một ngày thường.
 */
export class CreateOvertimeDto {
  @ApiProperty({
    example: 51,
    description: 'Nhân viên được hưởng giờ làm thêm.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId: number;

  @ApiProperty({
    example: '2026-05-25',
    description: 'Ngày làm thêm, YYYY-MM-DD',
  })
  @IsCalendarDate()
  workDate: string;

  @ApiProperty({ example: '18:00', description: 'Giờ bắt đầu, HH:mm' })
  @IsClockTime()
  startTime: string;

  @ApiProperty({
    example: '21:00',
    description:
      'Giờ kết thúc, HH:mm. Nhỏ hơn hoặc bằng giờ bắt đầu nghĩa là sang ngày hôm sau (ca đêm).',
  })
  @IsClockTime()
  endTime: string;

  @ApiProperty({
    example: 'Xử lý sự cố hệ thống thanh toán',
    description:
      'Lý do làm thêm — bắt buộc, đây là hồ sơ đối chiếu khi thanh tra lao động.',
    minLength: 5,
    maxLength: 500,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}
