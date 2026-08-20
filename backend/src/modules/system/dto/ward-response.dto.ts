import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';

/**
 * Một phường/xã/đặc khu (api-spec.md §20).
 *
 * Nguồn: `src/common/data/vn-administrative-units-2025.csv` — chính file danh
 * mục cơ quan thuế phát hành, đọc thẳng chứ không qua bản sao phái sinh, và
 * KHÔNG gọi API bên ngoài lúc chạy. 3.321 đơn vị: 687 phường, 2.621 xã, 13 đặc
 * khu.
 *
 * `code` là mã của HỆ THỐNG THUẾ (TMS), ví dụ `10105001`. Chọn hệ mã này thay
 * vì mã GSO vì Giai đoạn 6 sẽ quyết toán thuế TNCN: dùng đúng mã cơ quan thuế
 * dùng thì số liệu đi nộp không phải map thêm một lần nữa.
 */
export class WardResponseDto {
  @ApiProperty({ example: '10105001' })
  code: string;

  @ApiProperty({ example: 'Phường Hoàn Kiếm' })
  name: string;

  @ApiProperty({ example: '01', description: 'Mã tỉnh BNV (01–34)' })
  provinceCode: string;

  @ApiProperty({
    example: 'phuong',
    enum: ['phuong', 'xa', 'dac_khu'],
  })
  type: string;

  @ApiProperty({
    example: '10105',
    description:
      'Quận/huyện CŨ mà đơn vị này tách ra. Cấp huyện đã bị bỏ từ 01/07/2025 — chỉ dùng để đối chiếu hồ sơ cũ, KHÔNG dùng cho nhập liệu mới.',
  })
  legacyDistrictCode: string;

  @ApiProperty({ example: 'Quận Hoàn Kiếm' })
  legacyDistrictName: string;
}

/** Query của `GET /system/wards`. */
export class WardQueryDto {
  @ApiProperty({
    required: false,
    example: '01',
    description:
      'Lọc theo tỉnh. Bỏ trống trả về CẢ 3.321 đơn vị — chỉ nên dùng khi thực sự cần toàn bộ danh mục.',
  })
  @IsOptional()
  @Type(() => String)
  @IsString()
  @Matches(/^\d{1,10}$/, { message: 'provinceCode must be 1-10 digits' })
  provinceCode?: string;
}
