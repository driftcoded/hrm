import { Module } from '@nestjs/common';
import { EmployeesModule } from '@/modules/employees/employees.module';
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
 */
@Module({
  imports: [EmployeesModule],
  controllers: [ReportsController],
  providers: [EmployeeExportService],
  exports: [EmployeeExportService],
})
export class ReportsModule {}
