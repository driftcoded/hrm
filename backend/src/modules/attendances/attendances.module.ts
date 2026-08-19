import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeesModule } from '@/modules/employees/employees.module';
import { OvertimeModule } from '@/modules/overtime/overtime.module';
import { HolidaysModule } from '@/modules/system/holidays.module';
import { AttendanceImportService } from './attendance-import.service';
import { AttendancesController } from './attendances.controller';
import { AttendancesRepository } from './attendances.repository';
import { AttendancesService } from './attendances.service';
import { Attendance } from './entities/attendance.entity';

/**
 * Chấm công (PLAN 4.1, api-spec.md §7).
 *
 * `HolidaysModule` để đếm ngày công trong tháng (trừ ngày lễ); `OvertimeModule`
 * để lấy số giờ làm thêm ĐÃ DUYỆT — bảng tổng hợp đặt nó cạnh số giờ ở lại
 * thực tế, hai con số phục vụ hai mục đích khác nhau.
 *
 * `AttendanceImportService` dùng `EmployeesRepository` (do `EmployeesModule`
 * export) để đổi mã nhân viên sang id trong MỘT truy vấn cho cả file.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Attendance]),
    EmployeesModule,
    HolidaysModule,
    OvertimeModule,
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
