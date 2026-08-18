import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from '@/modules/departments/entities/department.entity';
import { Employee } from '@/modules/employees/entities/employee.entity';
import { Position } from './entities/position.entity';
import { PositionsController } from './positions.controller';
import { PositionsRepository } from './positions.repository';
import { PositionsService } from './positions.service';

/**
 * Department/Employee are only used for existence checks and reference counts
 * (validating departmentId, guarding position deletion).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Position, Department, Employee])],
  controllers: [PositionsController],
  providers: [PositionsRepository, PositionsService],
  exports: [PositionsService],
})
export class PositionsModule {}
