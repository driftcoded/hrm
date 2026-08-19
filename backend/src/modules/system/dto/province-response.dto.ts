import { ApiProperty } from '@nestjs/swagger';

/**
 * Một tỉnh/thành phố (api-spec.md §20).
 *
 * Nguồn dữ liệu là file tĩnh `src/common/data/vn-provinces.json` (34 tỉnh/thành
 * sau sáp nhập 2025) chứ không phải bảng DB: schema 26 bảng KHÔNG có bảng
 * tỉnh/huyện/xã, `employees` chỉ lưu `province_code`/`district_code`/`ward_code`
 * dạng text — quyết định phạm vi từ Giai đoạn 0.1.
 *
 * ⚠️ CHƯA có `/system/districts` và `/system/wards`: dự án chưa có nguồn dữ
 * liệu quận/huyện/phường/xã. Form nhân viên vì thế phải cho nhập tay hai mã đó.
 */
export class ProvinceResponseDto {
  @ApiProperty({ example: '01' })
  code: string;

  @ApiProperty({ example: 'Thành phố Hà Nội' })
  name: string;

  @ApiProperty({ example: 'city', enum: ['city', 'province'] })
  type: string;
}
