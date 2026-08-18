import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveBalance } from '@/modules/leave-balances/entities/leave-balance.entity';
import { LeaveRequest } from './entities/leave-request.entity';
import { LeaveType } from './entities/leave-type.entity';
import { LeaveTypesController } from './leave-types.controller';
import { LeaveTypesRepository } from './leave-types.repository';
import { LeaveTypesService } from './leave-types.service';

/**
 * Phase 2.1 only covers `leave_types` master data.
 * Leave request business logic (`/leaves`, api-spec.md §8) is Phase 5 and will
 * get its own `LeavesModule` in this same directory.
 *
 * LeaveRequest/LeaveBalance are registered here only to COUNT references
 * before a delete.
 */
@Module({
  imports: [TypeOrmModule.forFeature([LeaveType, LeaveRequest, LeaveBalance])],
  controllers: [LeaveTypesController],
  providers: [LeaveTypesRepository, LeaveTypesService],
  exports: [LeaveTypesService],
})
export class LeaveTypesModule {}
