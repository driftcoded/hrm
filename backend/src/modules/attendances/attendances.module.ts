import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeesModule } from '@/modules/employees/employees.module';
import { OvertimeModule } from '@/modules/overtime/overtime.module';
import { HolidaysModule } from '@/modules/system/holidays.module';
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
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Attendance]),
    EmployeesModule,
    HolidaysModule,
    OvertimeModule,
  ],
  controllers: [AttendancesController],
  providers: [AttendancesRepository, AttendancesService],
  exports: [AttendancesService],
})
export class AttendancesModule {}
