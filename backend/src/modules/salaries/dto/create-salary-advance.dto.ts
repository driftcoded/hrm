import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { FIRST_SUPPORTED_PAYROLL_YEAR } from '@/common/constants/payroll.constant';
import { IsCalendarDate } from '@/common/validators/is-calendar-date.validator';

/**
 * Body của `POST /salary-advances`.
 *
 * NGÀY ỨNG TIỀN TÁCH KHỎI KỲ LƯƠNG BỊ TRỪ, và cả hai đều bắt buộc: ứng ngày
 * 28/07 để trừ vào lương tháng 8 là chuyện bình thường. Suy kỳ trừ từ ngày ứng
 * sẽ đoán sai đúng những trường hợp đó, mà đoán sai ở đây nghĩa là trừ hai lần
 * hoặc không trừ lần nào.
 */
export class CreateSalaryAdvanceDto {
  @ApiProperty({ example: 51 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeId: number;

  @ApiProperty({ example: 5000000, minimum: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ example: '2026-08-20', description: 'Ngày thực chi tiền.' })
  @IsCalendarDate()
  advanceDate: string;

  @ApiProperty({ example: 9, minimum: 1, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  deductMonth: number;

  @ApiProperty({ example: 2026, minimum: FIRST_SUPPORTED_PAYROLL_YEAR })
  @Type(() => Number)
  @IsInt()
  @Min(FIRST_SUPPORTED_PAYROLL_YEAR)
  deductYear: number;

  @ApiProperty({ example: 'Ứng trước tiền viện phí', maxLength: 255 })
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  reason: string;
}
