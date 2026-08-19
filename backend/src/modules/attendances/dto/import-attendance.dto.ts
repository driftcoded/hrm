import { ApiProperty } from '@nestjs/swagger';

/** Một dòng bị từ chối, kèm vị trí trong file để HR sửa đúng ô. */
export class AttendanceImportErrorDto {
  @ApiProperty({
    example: 7,
    description:
      'Số dòng TRONG FILE EXCEL (dòng 1 là tiêu đề), không phải số thứ tự bản ghi.',
  })
  row: number;

  @ApiProperty({ example: 'NV0051', nullable: true, type: String })
  employeeCode: string | null;

  @ApiProperty({ example: 'INVALID_TIME' })
  code: string;

  @ApiProperty({
    example: 'Giờ ra "07:00" sớm hơn giờ vào "08:00"',
    description:
      'Tiếng Việt — khác với `error.message` của API, chuỗi này ĐƯỢC hiển thị cho người dùng.',
  })
  message: string;
}

/**
 * Kết quả `POST /attendances/bulk-import`.
 *
 * Trả về cùng một shape cho cả lần chạy thử lẫn lần nhập thật, để màn hình
 * xem trước và màn hình kết quả dùng chung một cách đọc.
 */
export class AttendanceImportResultDto {
  @ApiProperty({
    example: false,
    description: '`true` = chỉ kiểm tra, KHÔNG ghi gì vào DB.',
  })
  dryRun: boolean;

  @ApiProperty({
    example: 120,
    description: 'Số dòng dữ liệu đọc được (không kể tiêu đề).',
  })
  totalRows: number;

  @ApiProperty({
    example: 98,
    description:
      'Số bản ghi được TẠO MỚI. Bằng 0 khi `dryRun` hoặc khi file có lỗi.',
  })
  created: number;

  @ApiProperty({
    example: 22,
    description:
      'Số bản ghi GHI ĐÈ lên ngày công đã có sẵn. Luôn được trả về để HR biết mình vừa thay đổi dữ liệu cũ, kể cả khi chạy thử.',
  })
  updated: number;

  @ApiProperty({
    type: [AttendanceImportErrorDto],
    description:
      'Rỗng nghĩa là file hợp lệ. Có phần tử nghĩa là KHÔNG dòng nào được ghi.',
  })
  errors: AttendanceImportErrorDto[];
}
