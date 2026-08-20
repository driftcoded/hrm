import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { TrainingParticipantDto } from './dto/training-response.dto';
import { TrainingsService } from './trainings.service';

/** Lịch sử đào tạo của một nhân viên. Phạm vi xem theo hồ sơ nhân viên. */
@ApiTags('Trainings')
@Controller('employees/:employeeId/trainings')
export class EmployeeTrainingsController {
  constructor(private readonly service: TrainingsService) {}

  @Get()
  @ApiAuth()
  @ApiOperation({
    summary: 'Lịch sử đào tạo của một nhân viên',
    description: 'Mới nhất trước, kèm kết quả và chứng chỉ nếu đã có.',
  })
  @ApiOkResponse({ type: [TrainingParticipantDto] })
  @ApiNotFoundResponse({ description: 'EMPLOYEE_NOT_FOUND' })
  findAll(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TrainingParticipantDto[]> {
    return this.service.findByEmployee(employeeId, user);
  }
}
