import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from '@/modules/contracts/entities/contract.entity';
import { Department } from '@/modules/departments/entities/department.entity';
import { Dependent } from '@/modules/dependents/entities/dependent.entity';
import { Position } from '@/modules/positions/entities/position.entity';
import { EmployeesController } from './employees.controller';
import { EmployeesRepository } from './employees.repository';
import { EmployeesService } from './employees.service';
import { Employee } from './entities/employee.entity';

/**
 * Department/Position được đăng ký ở đây để kiểm tra tồn tại + khớp phòng ban
 * khi gán nhân viên; Contract/Dependent để dựng `GET /employees/:id/summary`.
 * Nghiệp vụ của các bảng đó thuộc module riêng — module này chỉ ĐỌC.
 *
 * StorageService (upload avatar) đến từ StorageModule đã khai báo `@Global()`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      Department,
      Position,
      Contract,
      Dependent,
    ]),
  ],
  controllers: [EmployeesController],
  providers: [EmployeesRepository, EmployeesService],
  exports: [EmployeesService, EmployeesRepository],
})
export class EmployeesModule {}
