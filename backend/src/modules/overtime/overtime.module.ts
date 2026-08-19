import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeesModule } from '@/modules/employees/employees.module';
import { HolidaysModule } from '@/modules/system/holidays.module';
import { OvertimeRequest } from './entities/overtime-request.entity';
import { OvertimeController } from './overtime.controller';
import { OvertimeRepository } from './overtime.repository';
import { OvertimeService } from './overtime.service';

/**
 * Đăng ký + duyệt làm thêm giờ (PLAN 4.1).
 *
 * `EmployeesModule` cho `resolveScope` (ai thấy/duyệt được đơn của ai),
 * `HolidaysModule` để biết ngày làm thêm có phải ngày lễ — quyết định hệ số 3×.
 *
 * Export `OvertimeService` vì `AttendancesModule` cần tổng giờ ĐÃ DUYỆT cho
 * bảng tổng hợp tháng. Chiều phụ thuộc chỉ đi một hướng
 * (attendances → overtime) nên không có vòng lặp.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([OvertimeRequest]),
    EmployeesModule,
    HolidaysModule,
  ],
  controllers: [OvertimeController],
  providers: [OvertimeRepository, OvertimeService],
  exports: [OvertimeService],
})
export class OvertimeModule {}
