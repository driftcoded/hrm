import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body của `POST /attendances/check-in` (api-spec.md §7).
 *
 * KHÔNG nhận `employeeId` và KHÔNG nhận giờ chấm: nhân viên tự chấm cho CHÍNH
 * MÌNH, và giờ do server đọc. Cho client gửi giờ lên là mở đường cho việc tự
 * khai giờ vào — muốn sửa giờ thì đi qua `PATCH /attendances/:id`, nơi có
 * phân quyền HR và có lưu lý do.
 */
export class CheckInDto {
  @ApiPropertyOptional({
    description: 'Ghi chú tuỳ chọn, ví dụ lý do đến muộn',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
