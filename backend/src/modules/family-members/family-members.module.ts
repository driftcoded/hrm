import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeesModule } from '@/modules/employees/employees.module';
import { FamilyMember } from './entities/family-member.entity';
import { FamilyMembersController } from './family-members.controller';
import { FamilyMembersRepository } from './family-members.repository';
import { FamilyMembersService } from './family-members.service';

/**
 * EmployeesModule được import để dùng lại kiểm tra phạm vi truy cập hồ sơ
 * nhân viên (EmployeesService.findOne) thay vì viết lại quy tắc phân quyền.
 */
@Module({
  imports: [TypeOrmModule.forFeature([FamilyMember]), EmployeesModule],
  controllers: [FamilyMembersController],
  providers: [FamilyMembersRepository, FamilyMembersService],
  exports: [FamilyMembersService],
})
export class FamilyMembersModule {}
