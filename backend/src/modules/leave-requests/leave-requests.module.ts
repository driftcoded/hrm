import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeesModule } from '@/modules/employees/employees.module';
import { LeaveRequest } from '@/modules/leaves/entities/leave-request.entity';
import { LeaveTypesModule } from '@/modules/leaves/leave-types.module';
import { HolidaysModule } from '@/modules/system/holidays.module';
import { LeaveRequestsController } from './leave-requests.controller';
import { LeaveRequestsRepository } from './leave-requests.repository';
import { LeaveRequestsService } from './leave-requests.service';

/**
 * Đơn nghỉ phép (PLAN 5.1).
 *
 * `EmployeesModule` cho `resolveScope`; `LeaveTypesModule` để đọc giới hạn của
 * từng loại phép; `HolidaysModule` để không trừ phép vào ngày lễ.
 *
 * KHÔNG import `LeaveBalancesModule` dù có sửa `leave_balances`: quỹ phép được
 * cập nhật qua `EntityManager` của transaction đang chạy, cùng một transaction
 * với đơn. Gọi service khác sẽ chạy ngoài transaction đó, và nếu một trong hai
 * bước hỏng thì quỹ phép nói khác với danh sách đơn.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveRequest]),
    EmployeesModule,
    LeaveTypesModule,
    HolidaysModule,
  ],
  controllers: [LeaveRequestsController],
  providers: [LeaveRequestsRepository, LeaveRequestsService],
  exports: [LeaveRequestsService],
})
export class LeaveRequestsModule {}
