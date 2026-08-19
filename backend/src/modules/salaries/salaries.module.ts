import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attendance } from '@/modules/attendances/entities/attendance.entity';
import { Contract } from '@/modules/contracts/entities/contract.entity';
import { Employee } from '@/modules/employees/entities/employee.entity';
import { EmployeesModule } from '@/modules/employees/employees.module';
import { LeaveRequestsModule } from '@/modules/leave-requests/leave-requests.module';
import { LeaveRequest } from '@/modules/leaves/entities/leave-request.entity';
import { HolidaysModule } from '@/modules/system/holidays.module';
import { PayrollSettings } from './entities/payroll-settings.entity';
import { SalaryAdvance } from './entities/salary-advance.entity';
import { Salary } from './entities/salary.entity';
import { PayrollRepository } from './payroll.repository';
import { PayrollService } from './payroll.service';
import { PayrollSettingsController } from './payroll-settings.controller';
import { PayrollSettingsService } from './payroll-settings.service';
import { SalariesController } from './salaries.controller';
import { SalariesRepository } from './salaries.repository';
import { SalariesService } from './salaries.service';
import { SalaryAdvancesController } from './salary-advances.controller';
import { SalaryAdvancesService } from './salary-advances.service';

/**
 * Lương (PLAN giai đoạn 6).
 *
 * MODULE NÀY ĐỌC RẤT NHIỀU BẢNG CỦA NGƯỜI KHÁC — hợp đồng, chấm công, đơn nghỉ,
 * người phụ thuộc — vì một dòng lương là kết quả của tất cả những thứ đó. Nó
 * đăng ký entity của các module khác qua `forFeature` để đọc, nhưng KHÔNG ghi
 * vào bảng nào ngoài `salaries`, `salary_advances` và `payroll_settings`.
 *
 * `LeaveRequestsModule` được import để đếm ngày phép CÓ LƯƠNG: bảng chấm công
 * chỉ ghi `status = leave`, không nói loại phép nào, mà "có lương hay không" nằm
 * ở `leave_types.is_paid`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Salary,
      SalaryAdvance,
      PayrollSettings,
      Employee,
      Contract,
      Attendance,
      LeaveRequest,
    ]),
    EmployeesModule,
    LeaveRequestsModule,
    HolidaysModule,
  ],
  controllers: [
    SalariesController,
    SalaryAdvancesController,
    PayrollSettingsController,
  ],
  providers: [
    PayrollRepository,
    SalariesRepository,
    PayrollService,
    PayrollSettingsService,
    SalariesService,
    SalaryAdvancesService,
  ],
  exports: [SalariesService, PayrollSettingsService],
})
export class SalariesModule {}
