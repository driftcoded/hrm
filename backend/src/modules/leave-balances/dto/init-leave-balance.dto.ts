import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsBooleanValue } from '@/common/decorators/is-boolean-value.decorator';
import { MAX_LEAVE_YEAR, MIN_LEAVE_YEAR } from './filter-leave-balance.dto';

/**
 * Body của `POST /leave-balances/init` — khởi tạo quỹ phép năm cho toàn bộ
 * nhân viên đang làm việc.
 *
 * KHÔNG nhận danh sách nhân viên: đây là thao tác đầu năm cho cả công ty, và
 * cho phép chọn một nhóm sẽ đẻ ra câu hỏi "ai chưa được khởi tạo" mà không ai
 * trả lời được. Muốn sửa riêng một người thì dùng `PATCH /leave-balances/:id`.
 */
export class InitLeaveBalanceDto {
  @ApiProperty({
    example: 2026,
    minimum: MIN_LEAVE_YEAR,
    maximum: MAX_LEAVE_YEAR,
  })
  @Type(() => Number)
  @IsInt()
  @Min(MIN_LEAVE_YEAR)
  @Max(MAX_LEAVE_YEAR)
  year: number;

  @ApiPropertyOptional({
    default: false,
    description:
      'true = chỉ TÍNH THỬ, không ghi gì. Trả về đúng số bản ghi sẽ tạo và danh sách người đã có quỹ phép.',
  })
  @IsOptional()
  @IsBooleanValue()
  dryRun?: boolean;

  @ApiPropertyOptional({
    default: false,
    description:
      'true = cộng số ngày phép còn lại của năm trước vào `carried_over`. Mặc định false — chuyển phép sang năm sau là quy định nội bộ, không phải luật, nên phải chọn tường minh.',
  })
  @IsOptional()
  @IsBooleanValue()
  carryOver?: boolean;
}
