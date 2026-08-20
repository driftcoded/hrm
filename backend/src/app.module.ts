import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { appConfig } from './config/app.config';
import { authConfig } from './config/auth.config';
import { databaseConfig } from './config/database.config';
import { jwtConfig } from './config/jwt.config';
import { mailConfig } from './config/mail.config';
import { settingsConfig } from './config/settings.config';
import { storageConfig } from './config/storage.config';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { CacheModule } from './shared/cache/cache.module';
import { MailModule } from './shared/mail/mail.module';
import { StorageModule } from './shared/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { ContractTypesModule } from './modules/contracts/contract-types.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { DependentsModule } from './modules/dependents/dependents.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { FamilyMembersModule } from './modules/family-members/family-members.module';
import { LeaveTypesModule } from './modules/leaves/leave-types.module';
import { PositionsModule } from './modules/positions/positions.module';
import { AttendancesModule } from './modules/attendances/attendances.module';
import { LeaveBalancesModule } from './modules/leave-balances/leave-balances.module';
import { LeaveRequestsModule } from './modules/leave-requests/leave-requests.module';
import { SalariesModule } from './modules/salaries/salaries.module';
import { DisciplinesRewardsModule } from './modules/disciplines-rewards/disciplines-rewards.module';
import { ReportsModule } from './modules/reports/reports.module';
import { HolidaysModule } from './modules/system/holidays.module';
import { SystemModule } from './modules/system/system.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      load: [
        appConfig,
        databaseConfig,
        jwtConfig,
        authConfig,
        mailConfig,
        settingsConfig,
        storageConfig,
      ],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),
    DatabaseModule,
    CacheModule,
    MailModule,
    StorageModule,
    AuthModule,
    UsersModule,
    // Master data – Giai đoạn 2.1
    DepartmentsModule,
    PositionsModule,
    ContractTypesModule,
    LeaveTypesModule,
    HolidaysModule,
    SystemModule,
    // Nhân viên & hồ sơ – Giai đoạn 3.1
    EmployeesModule,
    ContractsModule,
    FamilyMembersModule,
    DependentsModule,
    // Báo cáo & xuất file – api-spec.md §19
    AttendancesModule,
    LeaveBalancesModule,
    LeaveRequestsModule,
    SalariesModule,

    DisciplinesRewardsModule,

    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    // Thứ tự đăng ký = thứ tự thực thi: JwtAuthGuard -> RolesGuard
    // (docs/architecture.md §6.2). Endpoint public dùng @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
