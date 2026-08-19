import { ApiProperty } from '@nestjs/swagger';
import { IsCalendarDate } from '@/common/validators/is-calendar-date.validator';

/**
 * Query của `GET /leave-requests/calendar`.
 *
 * `from`/`to` BẮT BUỘC: lịch "ai đang nghỉ" luôn là câu hỏi về một khoảng thời
 * gian cụ thể. Không có khoảng thì truy vấn trả về toàn bộ lịch sử nghỉ phép của
 * công ty — vừa vô nghĩa với người xem, vừa là một cú quét cả bảng.
 */
export class LeaveCalendarQueryDto {
  @ApiProperty({ example: '2026-05-01', description: 'YYYY-MM-DD' })
  @IsCalendarDate()
  from: string;

  @ApiProperty({ example: '2026-05-31', description: 'YYYY-MM-DD' })
  @IsCalendarDate()
  to: string;
}
