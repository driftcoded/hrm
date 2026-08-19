import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body của `PATCH /leave-requests/:id/reject`.
 *
 * Lý do BẮT BUỘC. Từ chối một đơn nghỉ mà không nói vì sao thì người ghi không
 * biết nên sửa gì để nộp lại, và người duyệt không phải chịu trách nhiệm về
 * quyết định của mình.
 */
export class RejectLeaveRequestDto {
  @ApiProperty({
    example: 'Trùng lịch nghỉ của hai người trong cùng bộ phận',
    minLength: 5,
    maxLength: 500,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}
