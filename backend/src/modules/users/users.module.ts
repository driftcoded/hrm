import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../auth/entities/role.entity';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

/**
 * Giai đoạn 1.1 chỉ cần tầng service/repository để AuthModule dùng.
 * Giai đoạn 3.2 thêm `POST /users` + `GET /roles` cho bước "tài khoản" của
 * wizard tạo nhân viên; phần còn lại của api-spec §13 vẫn chưa làm.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User, Role])],
  controllers: [UsersController],
  providers: [UsersRepository, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
