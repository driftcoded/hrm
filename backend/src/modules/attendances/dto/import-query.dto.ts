import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { IsBooleanValue } from '@/common/decorators/is-boolean-value.decorator';

/** Query của `POST /attendances/bulk-import`. */
export class ImportQueryDto {
  @ApiPropertyOptional({
    description:
      '`true` = chỉ KIỂM TRA file và trả về kết quả dự kiến, KHÔNG ghi gì vào DB. ' +
      'Màn hình import gọi bước này trước để người dùng thấy sẽ tạo mới bao nhiêu, ghi đè bao nhiêu.',
    default: false,
  })
  @IsOptional()
  @IsBooleanValue()
  dryRun?: boolean;
}
