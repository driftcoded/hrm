import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeesModule } from '@/modules/employees/employees.module';
import { DependentsController } from './dependents.controller';
import { DependentsRepository } from './dependents.repository';
import { DependentsService } from './dependents.service';
import { Dependent } from './entities/dependent.entity';

/**
 * EmployeesModule được import để dùng lại kiểm tra phạm vi truy cập hồ sơ nhân
 * viên (EmployeesService.findOne) thay vì viết lại quy tắc phân quyền — giống
 * hệt FamilyMembersModule.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Dependent]), EmployeesModule],
  controllers: [DependentsController],
  providers: [DependentsRepository, DependentsService],
  exports: [DependentsService],
})
export class DependentsModule {}
