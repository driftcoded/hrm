import { Controller, Get, Query, Res } from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { AttendanceExportService } from './attendance-export.service';
import { ExportAttendancesDto } from './dto/export-attendances.dto';
import { ExportEmployeesDto } from './dto/export-employees.dto';
import {
  EMPLOYEE_EXPORT_ROLES,
  EmployeeExportService,
  MAX_EXPORT_ROWS,
} from './employee-export.service';
import { XLSX_CONTENT_TYPE } from './utils/excel.util';

/**
 * Controller CHỈ nhận request / trả response (CLAUDE.md §Kiến trúc module):
 * toàn bộ quyết định nghiệp vụ (phạm vi dữ liệu, che dữ liệu nhạy cảm, trần số
 * dòng, nội dung workbook) nằm ở `EmployeeExportService`.
 *
 * `@Res()` KHÔNG dùng `passthrough`: `TransformInterceptor` toàn cục bọc mọi
 * giá trị trả về vào `{ success, data, timestamp }`, mà response ở đây là một
 * file nhị phân chứ không phải JSON. Tự ghi thẳng vào `res` là cách duy nhất
 * đi vòng qua interceptor mà KHÔNG phải sửa interceptor dùng chung.
 * Lỗi ném ra từ service vẫn đi qua `HttpExceptionFilter` như thường vì lúc đó
 * chưa có gì được ghi vào `res`.
 */
@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly employeeExportService: EmployeeExportService,
    private readonly attendanceExportService: AttendanceExportService,
  ) {}

  @Get('employees/export')
  @Roles(...EMPLOYEE_EXPORT_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Xuất danh sách nhân viên ra Excel (.xlsx)',
    description:
      'File gồm 3 sheet: `Danh sách`, `Thông tin BH`, `Thông tin lương` (api-spec.md §19).\n\n' +
      '**Filter:** dùng chung bộ filter của `GET /employees` — file xuất ra đúng bằng những dòng đang hiển thị trên màn hình. ' +
      '`page`/`limit` bị bỏ qua: bản xuất không phân trang.\n\n' +
      `**Trần số dòng:** ${MAX_EXPORT_ROWS}. Vượt trần trả 422 EXPORT_TOO_MANY_ROWS, KHÔNG cắt bớt im lặng.\n\n` +
      '**Phạm vi dữ liệu:** theo đúng phạm vi của `GET /employees` (EmployeesService.resolveScope).\n\n' +
      '**Dữ liệu nhạy cảm:** mặc định CCCD và số tài khoản bị che (`********9432`), các cột tiền để trống. ' +
      '`?includeSensitive=true` trả bản đầy đủ và CHỈ dành cho `admin`/`hr_manager`; mỗi lần như vậy được ghi log mức `warn` kèm người yêu cầu.',
  })
  @ApiProduces(XLSX_CONTENT_TYPE)
  @ApiOkResponse({
    description: 'File .xlsx',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiForbiddenResponse({
    description:
      'FORBIDDEN – role không được xuất file; SENSITIVE_EXPORT_FORBIDDEN – role không được lấy bản không che',
  })
  @ApiUnprocessableEntityResponse({
    description: 'EXPORT_TOO_MANY_ROWS – filter khớp quá nhiều dòng',
  })
  async exportEmployees(
    @Query() filter: ExportEmployeesDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.employeeExportService.exportEmployees(
      filter,
      user,
    );

    response.setHeader('Content-Type', XLSX_CONTENT_TYPE);
    response.setHeader('Content-Disposition', result.contentDisposition);
    response.setHeader('Content-Length', result.buffer.length);
    // File tải về không bao giờ được trình duyệt đoán lại kiểu và thực thi.
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.end(result.buffer);
  }

  @Get('attendances/export')
  @Roles(...AttendanceExportService.EXPORT_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Xuất bảng chấm công tháng ra Excel (.xlsx)',
    description:
      'File gồm 2 sheet: `Chi tiết` (mỗi dòng một ngày công) và `Tổng hợp` (mỗi dòng một người, cộng dồn cả tháng).\n\n' +
      '`month` và `year` BẮT BUỘC — bảng chấm công là tài liệu của MỘT tháng.\n\n' +
      '**Phạm vi dữ liệu:** đi qua `AttendancesService.findAll`, nên `manager` chỉ xuất được phòng ban mình quản.\n\n' +
      `**Trần số dòng:** ${AttendanceExportService.MAX_EXPORT_ROWS}. Vượt trần trả 422 EXPORT_TOO_MANY_ROWS, KHÔNG cắt bớt im lặng.\n\n` +
      'Cột "Giờ vượt ca (thực tế)" là số giờ đã ở lại làm, KHÔNG phải giờ được trả tiền làm thêm — tiền tính theo đơn đã duyệt ở `/overtime-requests`.',
  })
  @ApiProduces(XLSX_CONTENT_TYPE)
  @ApiOkResponse({
    description: 'File .xlsx',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiForbiddenResponse({
    description: 'FORBIDDEN – role không được xuất bảng chấm công',
  })
  @ApiUnprocessableEntityResponse({
    description: 'EXPORT_TOO_MANY_ROWS – filter khớp quá nhiều dòng',
  })
  async exportAttendances(
    @Query() filter: ExportAttendancesDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.attendanceExportService.exportMonth(filter, user);

    response.setHeader('Content-Type', XLSX_CONTENT_TYPE);
    response.setHeader('Content-Disposition', result.contentDisposition);
    response.setHeader('Content-Length', result.buffer.length);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.end(result.buffer);
  }
}
