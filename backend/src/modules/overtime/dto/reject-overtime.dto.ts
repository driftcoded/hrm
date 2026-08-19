import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body của `PATCH /overtime-requests/:id/reject`.
 *
 * Lý do là BẮT BUỘC. Từ chối một đơn làm thêm mà không nói vì sao thì người nộp
 * không biết nên sửa gì để nộp lại, và người duyệt không phải chịu trách nhiệm
 * về quyết định của mình.
 */
export class RejectOvertimeDto {
  @ApiProperty({
    example: 'Đã vượt trần 40 giờ làm thêm trong tháng',
    minLength: 5,
    maxLength: 500,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}
