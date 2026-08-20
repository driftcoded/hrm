import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeesModule } from '@/modules/employees/employees.module';
import { DisciplinesRewardsController } from './disciplines-rewards.controller';
import { DisciplinesRewardsRepository } from './disciplines-rewards.repository';
import { DisciplinesRewardsService } from './disciplines-rewards.service';
import { DisciplineReward } from './entities/discipline-reward.entity';

/** Khen thưởng & kỷ luật (PLAN 7.1). `EmployeesModule` cung cấp phạm vi xem hồ sơ. */
@Module({
  imports: [TypeOrmModule.forFeature([DisciplineReward]), EmployeesModule],
  controllers: [DisciplinesRewardsController],
  providers: [DisciplinesRewardsRepository, DisciplinesRewardsService],
  exports: [DisciplinesRewardsService],
})
export class DisciplinesRewardsModule {}
