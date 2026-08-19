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
 * `HolidaysModule` để biết một ngày công có rơi vào ngày lễ hay không. Điều đó
 * đổi cách tính: làm vào ngày lễ hay ngày nghỉ hằng tuần thì TOÀN BỘ ca là làm
 * thêm giờ (Điều 98 khoản 1 điểm b/c trả 200%/300% cho cả ca), và ngày đó không
 * xét đi muộn/về sớm vì không có giờ bắt đầu nào để so.
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
