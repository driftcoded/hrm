import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Body của `PATCH /salaries/:id` — chỉnh tay một dòng bảng lương.
 *
 * CHỈ NHỮNG KHOẢN KHÔNG SUY RA ĐƯỢC. Lương cơ bản, bảo hiểm, thuế, ngày công đều
 * do server tính từ hợp đồng và chấm công; cho sửa tay là mở đường cho một bảng
 * lương không khớp với bất kỳ dữ liệu gốc nào và không ai dò lại được.
 *
 * Ba khoản dưới đây thì ngược lại — chúng KHÔNG có nguồn nào khác trong hệ thống:
 * thưởng hiệu suất do quản lý quyết theo kỳ, thu nhập khác và khấu trừ khác là
 * những việc phát sinh. Sửa xong, server tính lại thuế và lương thực nhận.
 */
export class UpdateSalaryDto {
  @ApiPropertyOptional({ example: 3000000, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  performanceBonus?: number;

  @ApiPropertyOptional({ example: 500000, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  otherIncome?: number;

  @ApiPropertyOptional({ example: 200000, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  otherDeductions?: number;

  @ApiPropertyOptional({ example: 'Thưởng dự án Q3' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
