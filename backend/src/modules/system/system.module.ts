import { Module } from '@nestjs/common';
import { LeaveTypesModule } from '@/modules/leaves/leave-types.module';
import { HolidaysModule } from './holidays.module';
import { SystemController } from './system.controller';

/**
 * Holds only the `/system/*` lookup endpoints (api-spec.md §20). No dedicated
 * service/repository: every query goes through the service of the module that
 * owns the data.
 */
@Module({
  imports: [HolidaysModule, LeaveTypesModule],
  controllers: [SystemController],
})
export class SystemModule {}
