import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  IsString,
  Length,
  Min,
} from 'class-validator';

/**
 * Trần số người nhận mỗi lần gửi.
 *
 * Không phải giới hạn nghiệp vụ mà là chặn tai nạn: một request lỡ gửi cả nghìn
 * id sẽ giữ kết nối rất lâu và có thể làm nhà cung cấp SMTP chặn tài khoản.
 */
export const MAX_EMAIL_RECIPIENTS = 200;

/** Body của `POST /employees/email`. */
export class SendEmployeeEmailDto {
  @ApiProperty({
    example: [51, 52],
    description: `Nhân viên nhận email. Tối đa ${MAX_EMAIL_RECIPIENTS} người mỗi lần.`,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ArrayMaxSize(MAX_EMAIL_RECIPIENTS)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  employeeIds: number[];

  @ApiProperty({ example: 'Thông báo lịch nghỉ lễ 02/09' })
  @IsString()
  @Length(3, 200)
  subject: string;

  @ApiProperty({
    example: 'Kính gửi anh/chị,\n\nCông ty nghỉ lễ từ 01/09 đến hết 03/09.',
    description: 'Văn bản thuần. HTML bị escape trước khi dựng email.',
  })
  @IsString()
  @Length(10, 5000)
  body: string;
}

/** Một người nhận không gửi được, kèm lý do đọc được. */
export class FailedEmailRecipientDto {
  @ApiProperty({ example: 51 })
  employeeId: number;

  @ApiProperty({ example: 'NV0051' })
  employeeCode: string;

  @ApiProperty({ example: 'Nguyễn Văn Bình' })
  fullName: string;

  @ApiProperty({
    example: 'SEND_FAILED',
    enum: ['SEND_FAILED'],
    description: 'Transport mail từ chối địa chỉ này.',
  })
  reason: 'SEND_FAILED';
}

/**
 * Kết quả `POST /employees/email`.
 *
 * Trả về danh sách người KHÔNG nhận được chứ không chỉ một con số: gửi thông báo
 * mà vài người âm thầm trượt thì tệ hơn là không gửi, vì người gửi tưởng cả
 * danh sách đã nhận.
 */
export class SendEmployeeEmailResultDto {
  @ApiProperty({ example: 18 })
  sent: number;

  @ApiProperty({ example: 20, description: 'Số nhân viên được chọn.' })
  requested: number;

  @ApiProperty({ type: [FailedEmailRecipientDto] })
  failed: FailedEmailRecipientDto[];
}
