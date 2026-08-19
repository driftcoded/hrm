import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeesModule } from '@/modules/employees/employees.module';
import { Employee } from '@/modules/employees/entities/employee.entity';
import { ContractsController } from './contracts.controller';
import { ContractsRepository } from './contracts.repository';
import { ContractsService } from './contracts.service';
import { Contract } from './entities/contract.entity';

/**
 * EmployeesModule được import để dùng lại `EmployeesService.resolveScope()` /
 * `findOne()` — quyền xem hợp đồng bám theo đúng quyền xem hồ sơ của người ký,
 * không định nghĩa lại một bộ quy tắc thứ hai dễ lệch nhau.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Contract, Employee]), EmployeesModule],
  controllers: [ContractsController],
  providers: [ContractsRepository, ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
