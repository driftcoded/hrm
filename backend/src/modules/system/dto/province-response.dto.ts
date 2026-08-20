import { ApiProperty } from '@nestjs/swagger';

/**
 * Một tỉnh/thành phố (api-spec.md §20).
 *
 * Nguồn dữ liệu là file `src/common/data/vn-administrative-units-2025.csv`
 * (34 tỉnh/thành sau sáp nhập 2025) chứ không phải bảng DB: schema KHÔNG có
 * bảng tỉnh/huyện/xã, `employees` chỉ lưu `province_code`/`ward_code` dạng text
 * — quyết định phạm vi từ Giai đoạn 0.1.
 *
 * KHÔNG có `/system/districts`: cấp huyện đã chấm dứt hoạt động từ 01/07/2025
 * (Luật 72/2025/QH15).
 */
export class ProvinceResponseDto {
  @ApiProperty({ example: '01' })
  code: string;

  @ApiProperty({ example: 'Thành phố Hà Nội' })
  name: string;

  @ApiProperty({ example: 'city', enum: ['city', 'province'] })
  type: string;
}
