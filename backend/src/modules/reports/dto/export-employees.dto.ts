import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { IsBooleanValue } from '@/common/decorators/is-boolean-value.decorator';
import { FilterEmployeeDto } from '@/modules/employees/dto/filter-employee.dto';

/**
 * Query của `GET /reports/employees/export`.
 *
 * Kế thừa NGUYÊN VẸN `FilterEmployeeDto` (api-spec.md §19: "Các filter tương
 * tự GET /employees") thay vì khai báo một bộ filter song song — file xuất ra
 * phải chứa đúng những dòng người dùng đang nhìn thấy trên màn hình danh sách,
 * nên hai nơi bắt buộc dùng CHUNG một định nghĩa filter.
 *
 * `page`/`limit` kế thừa từ `PaginationDto` được CỐ Ý bỏ qua: xuất Excel 100
 * dòng thì vô dụng (xem `MAX_EXPORT_ROWS` trong employee-export.service.ts).
 */
export class ExportEmployeesDto extends FilterEmployeeDto {
  @ApiPropertyOptional({
    description:
      'true → xuất CCCD, số tài khoản và các cột tiền lương ở dạng ĐẦY ĐỦ (không che). ' +
      'Chỉ `admin`/`hr_manager` được phép; `hr_staff` gửi cờ này sẽ nhận 403 SENSITIVE_EXPORT_FORBIDDEN. ' +
      'Mặc định false: CCCD/số tài khoản bị che, các cột tiền để trống.',
    default: false,
  })
  @IsOptional()
  @IsBooleanValue()
  includeSensitive?: boolean;
}
