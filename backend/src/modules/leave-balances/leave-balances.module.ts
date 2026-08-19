import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeesModule } from '@/modules/employees/employees.module';
import { LeaveTypesModule } from '@/modules/leaves/leave-types.module';
import { LeaveBalance } from './entities/leave-balance.entity';
import { LeaveBalancesController } from './leave-balances.controller';
import { LeaveBalancesRepository } from './leave-balances.repository';
import { LeaveBalancesService } from './leave-balances.service';

/**
 * Quỹ phép năm (PLAN 5.1).
 *
 * `EmployeesModule` cho `resolveScope` (phạm vi dữ liệu) và
 * `EmployeesRepository.findActiveForAllocation` (đọc toàn bộ nhân viên đang làm
 * việc khi cấp quỹ đầu năm). `LeaveTypesModule` để tra loại phép `ANNUAL` theo
 * mã thay vì viết cứng id.
 *
 * Export `LeaveBalancesService` vì `LeaveRequestsModule` phải cập nhật
 * `pending_days`/`used_days` mỗi khi đơn đổi trạng thái.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveBalance]),
    EmployeesModule,
    LeaveTypesModule,
  ],
  controllers: [LeaveBalancesController],
  providers: [LeaveBalancesRepository, LeaveBalancesService],
  exports: [LeaveBalancesService, LeaveBalancesRepository],
})
export class LeaveBalancesModule {}
