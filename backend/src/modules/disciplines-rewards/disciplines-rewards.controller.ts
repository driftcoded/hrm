import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {
  EMPLOYEE_DELETE_ROLES,
  EMPLOYEE_WRITE_ROLES,
} from '@/common/constants/roles.constant';
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { CreateDisciplineRewardDto } from './dto/create-discipline-reward.dto';
import { DisciplineRewardResponseDto } from './dto/discipline-reward-response.dto';
import { UpdateDisciplineRewardDto } from './dto/update-discipline-reward.dto';
import { DisciplinesRewardsService } from './disciplines-rewards.service';
import { DisciplineRewardType } from './entities/discipline-reward.entity';

/**
 * Khen thưởng / kỷ luật theo nhân viên.
 *
 * GET không khai `@Roles()` — phạm vi do `EmployeesService.findOne()` quyết định.
 */
@ApiTags('Disciplines & Rewards')
@Controller('employees/:employeeId/disciplines-rewards')
export class DisciplinesRewardsController {
  constructor(private readonly service: DisciplinesRewardsService) {}

  @Get()
  @ApiAuth()
  @ApiOperation({
    summary: 'Khen thưởng và kỷ luật của một nhân viên',
    description: 'Mới nhất trước, theo ngày ký quyết định.',
  })
  @ApiQuery({ name: 'type', enum: DisciplineRewardType, required: false })
  @ApiOkResponse({ type: [DisciplineRewardResponseDto] })
  @ApiNotFoundResponse({ description: 'EMPLOYEE_NOT_FOUND' })
  findAll(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Query('type') type: DisciplineRewardType | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DisciplineRewardResponseDto[]> {
    return this.service.findAll(employeeId, type, user);
  }

  @Post()
  @Roles(...EMPLOYEE_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Ghi nhận một quyết định khen thưởng / kỷ luật',
    description:
      '`decisionDate` là ngày ký, `effectiveDate` là ngày có hiệu lực; hiệu lực không được trước ngày ký.',
  })
  @ApiCreatedResponse({ type: DisciplineRewardResponseDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN' })
  @ApiUnprocessableEntityResponse({
    description: 'EFFECTIVE_BEFORE_DECISION',
  })
  create(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Body() dto: CreateDisciplineRewardDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DisciplineRewardResponseDto> {
    return this.service.create(employeeId, dto, user);
  }

  @Patch(':recordId')
  @Roles(...EMPLOYEE_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Sửa một quyết định',
    description: 'Mọi trường tuỳ chọn; hiệu lực vẫn không được trước ngày ký.',
  })
  @ApiOkResponse({ type: DisciplineRewardResponseDto })
  @ApiNotFoundResponse({ description: 'DISCIPLINE_REWARD_NOT_FOUND' })
  update(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Param('recordId', ParseIntPipe) recordId: number,
    @Body() dto: UpdateDisciplineRewardDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DisciplineRewardResponseDto> {
    return this.service.update(employeeId, recordId, dto, user);
  }

  @Delete(':recordId')
  @Roles(...EMPLOYEE_DELETE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Xoá một quyết định',
    description: 'Hẹp hơn quyền ghi — `hr_staff` nhập được nhưng không xoá.',
  })
  @ApiOkResponse({ description: 'id + deleted' })
  @ApiNotFoundResponse({ description: 'DISCIPLINE_REWARD_NOT_FOUND' })
  remove(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Param('recordId', ParseIntPipe) recordId: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ id: number; deleted: boolean }> {
    return this.service.remove(employeeId, recordId, user);
  }
}
