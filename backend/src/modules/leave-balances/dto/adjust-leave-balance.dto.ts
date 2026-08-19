import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Body của `PATCH /leave-balances/:id` — nhân sự điều chỉnh quỹ phép.
 *
 * CHỈ sửa được `allocatedDays` và `carriedOver`. `usedDays` và `pendingDays` là
 * HỆ QUẢ của các đơn nghỉ đã ghi nhận — sửa tay hai cột đó sẽ làm quỹ phép lệch
 * khỏi danh sách đơn, và không ai biết bên nào đúng. Sai ở đâu thì sửa đơn ở đó.
 *
 * `remainingDays` là cột VIRTUAL của DB, không sửa được và cũng không cần.
 */
export class AdjustLeaveBalanceDto {
  @ApiPropertyOptional({ example: 14, minimum: 0, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(365)
  allocatedDays?: number;

  @ApiPropertyOptional({
    example: 2,
    minimum: 0,
    maximum: 365,
    description: 'Số ngày phép chuyển từ năm trước sang.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(365)
  carriedOver?: number;

  @ApiProperty({
    example: 'Bổ sung 2 ngày theo thoả thuận khi ký lại hợp đồng',
    description:
      'BẮT BUỘC — quỹ phép là quyền lợi của người lao động, mọi thay đổi thủ công phải nói được vì sao.',
    minLength: 5,
    maxLength: 500,
  })
  @IsString()
  @MinLength(5)
  reason: string;
}
