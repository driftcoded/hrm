import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '@/modules/employees/entities/employee.entity';
import { Position } from '@/modules/positions/entities/position.entity';
import { DepartmentsController } from './departments.controller';
import { DepartmentsRepository } from './departments.repository';
import { DepartmentsService } from './departments.service';
import { Department } from './entities/department.entity';

/**
 * Employee/Position are registered here only to COUNT records referencing a
 * department (employeeCount + delete guards). Business logic for those two
 * tables belongs to their own modules; this module never mutates them.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Department, Employee, Position])],
  controllers: [DepartmentsController],
  providers: [DepartmentsRepository, DepartmentsService],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
