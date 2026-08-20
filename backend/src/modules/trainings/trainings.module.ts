import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeesModule } from '@/modules/employees/employees.module';
import { EmployeeTrainingsController } from './employee-trainings.controller';
import { EmployeeTraining } from './entities/employee-training.entity';
import { Training } from './entities/training.entity';
import { TrainingsController } from './trainings.controller';
import { TrainingsRepository } from './trainings.repository';
import { TrainingsService } from './trainings.service';

/**
 * Đào tạo (PLAN 7.1).
 *
 * Hai controller dùng chung một service: `/trainings` theo khoá học,
 * `/employees/:id/trainings` theo nhân viên.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Training, EmployeeTraining]),
    EmployeesModule,
  ],
  controllers: [TrainingsController, EmployeeTrainingsController],
  providers: [TrainingsRepository, TrainingsService],
  exports: [TrainingsService],
})
export class TrainingsModule {}
