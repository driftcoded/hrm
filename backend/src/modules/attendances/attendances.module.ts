import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeesModule } from '@/modules/employees/employees.module';
import { HolidaysModule } from '@/modules/system/holidays.module';
import { AttendanceImportService } from './attendance-import.service';
import { AttendancesController } from './attendances.controller';
import { AttendancesRepository } from './attendances.repository';
import { AttendancesService } from './attendances.service';
import { Attendance } from './entities/attendance.entity';

/**
 * Chấm công (PLAN 4.1, api-spec.md §7).
 *
 * `HolidaysModule` để đếm ngày công trong tháng (trừ ngày lễ) và để phân loại
 * hệ số làm thêm: làm vào ngày lễ được trả 300% (Điều 98 BLLĐ 2019).
 *
 * Không còn `OvertimeModule`: giờ làm thêm suy ra từ chính bảng công, không có
 * bảng đơn từ song song — xem business-rules.md §12.3.
 *
 * `AttendanceImportService` dùng `EmployeesRepository` (do `EmployeesModule`
 * export) để đổi mã nhân viên sang id trong MỘT truy vấn cho cả file.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Attendance]),
    EmployeesModule,
    HolidaysModule,
  ],
  controllers: [AttendancesController],
  providers: [
    AttendancesRepository,
    AttendancesService,
    AttendanceImportService,
  ],
  exports: [AttendancesService],
})
export class AttendancesModule {}
