import { Module } from '@nestjs/common';
import { AttendancesModule } from '@/modules/attendances/attendances.module';
import { EmployeesModule } from '@/modules/employees/employees.module';
import { AttendanceExportService } from './attendance-export.service';
import { EmployeeExportService } from './employee-export.service';
import { ReportsController } from './reports.controller';

/**
 * Báo cáo / xuất file (docs/architecture.md §4 – `modules/reports/`).
 *
 * Module này KHÔNG sở hữu bảng nào và KHÔNG ghi dữ liệu: nó chỉ đọc lại các
 * module nghiệp vụ qua DI, nên không có `TypeOrmModule.forFeature()` và không
 * có repository riêng.
 *
 * `EmployeesModule` được import để dùng `EmployeesService.resolveScope()`
 * (phạm vi dữ liệu của người gọi) và `EmployeesRepository` (đọc hàng loạt) —
 * cùng nguồn với `GET /employees`, nên file xuất ra không bao giờ chứa nhiều
 * hơn những gì màn hình danh sách cho phép người đó xem.
 *
 * `AttendancesModule` cùng lý do: bản xuất bảng chấm công đọc qua
 * `AttendancesService.findAll`, đi thẳng vào repository sẽ là một đường lấy dữ
 * liệu không có phân quyền.
 */
@Module({
  imports: [EmployeesModule, AttendancesModule],
  controllers: [ReportsController],
  providers: [EmployeeExportService, AttendanceExportService],
  exports: [EmployeeExportService, AttendanceExportService],
})
export class ReportsModule {}
