import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

/**
 * Giai đoạn 1.1 chỉ cần tầng service/repository để AuthModule dùng.
 * Controller CRUD user (`/users`, api-spec.md §13) sẽ thêm ở giai đoạn sau.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersRepository, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
