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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { TRAINING_WRITE_ROLES } from '@/common/constants/roles.constant';
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { CompleteTrainingDto } from './dto/complete-training.dto';
import { CreateTrainingDto } from './dto/create-training.dto';
import { EnrollEmployeesDto } from './dto/enroll-employees.dto';
import { FilterTrainingDto } from './dto/filter-training.dto';
import {
  EnrollResultDto,
  TrainingParticipantDto,
  TrainingResponseDto,
} from './dto/training-response.dto';
import { UpdateTrainingDto } from './dto/update-training.dto';
import { TrainingsService } from './trainings.service';

/**
 * Khoá đào tạo và người tham gia.
 *
 * GET không khai `@Roles()` — ai đăng nhập được thì xem được danh mục khoá học.
 */
@ApiTags('Trainings')
@Controller('trainings')
export class TrainingsController {
  constructor(private readonly service: TrainingsService) {}

  @Get()
  @ApiAuth()
  @ApiOperation({
    summary: 'Danh sách khoá đào tạo',
    description:
      'Khoá sắp diễn ra trước; khoá chưa có ngày xuống cuối. `search` tìm theo mã hoặc tên.',
  })
  @ApiOkResponse({ type: PaginatedResponseDto })
  findAll(
    @Query() filter: FilterTrainingDto,
  ): Promise<PaginatedResponseDto<TrainingResponseDto>> {
    return this.service.findAll(filter);
  }

  @Get(':id')
  @ApiAuth()
  @ApiOperation({ summary: 'Chi tiết một khoá đào tạo' })
  @ApiOkResponse({ type: TrainingResponseDto })
  @ApiNotFoundResponse({ description: 'TRAINING_NOT_FOUND' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<TrainingResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(...TRAINING_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Mở một khoá đào tạo',
    description:
      'Khoá mới luôn ở trạng thái `planned`; không nhận `status` lúc tạo.',
  })
  @ApiCreatedResponse({ type: TrainingResponseDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN' })
  @ApiConflictResponse({ description: 'TRAINING_CODE_TAKEN' })
  @ApiUnprocessableEntityResponse({ description: 'INVALID_TRAINING_RANGE' })
  create(
    @Body() dto: CreateTrainingDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TrainingResponseDto> {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles(...TRAINING_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Sửa khoá đào tạo',
    description:
      'Trạng thái đi theo `planned` → `ongoing` → `completed`, hoặc `cancelled` khi chưa kết thúc; `completed` và `cancelled` là điểm cuối.\n\n' +
      'Sức chứa không hạ được xuống dưới số người đã ghi danh.',
  })
  @ApiOkResponse({ type: TrainingResponseDto })
  @ApiConflictResponse({
    description: 'TRAINING_INVALID_TRANSITION · TRAINING_CODE_TAKEN',
  })
  @ApiUnprocessableEntityResponse({
    description: 'TRAINING_CAPACITY_BELOW_ENROLLED · INVALID_TRAINING_RANGE',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTrainingDto,
  ): Promise<TrainingResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(...TRAINING_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Xoá một khoá chưa có ai ghi danh',
    description:
      'Chỉ xoá được khoá chưa có ai ghi danh. Khoá đã có người thì chuyển sang `cancelled`.',
  })
  @ApiOkResponse({ description: 'id + deleted' })
  @ApiUnprocessableEntityResponse({ description: 'TRAINING_HAS_PARTICIPANTS' })
  remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ id: number; deleted: boolean }> {
    return this.service.remove(id);
  }

  // ----------------------------------------------------- người tham gia ----

  @Get(':id/participants')
  @ApiAuth()
  @ApiOperation({ summary: 'Danh sách người tham gia một khoá' })
  @ApiOkResponse({ type: [TrainingParticipantDto] })
  findParticipants(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TrainingParticipantDto[]> {
    return this.service.findParticipants(id);
  }

  @Post(':id/participants')
  @Roles(...TRAINING_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Ghi danh nhân viên vào khoá',
    description:
      'Nhận danh sách nhiều nhân viên trong một lần gọi.\n\n' +
      'Người đã có trong khoá được bỏ qua và trả về ở `alreadyEnrolled`.',
  })
  @ApiCreatedResponse({ type: EnrollResultDto })
  @ApiConflictResponse({ description: 'TRAINING_CLOSED' })
  @ApiUnprocessableEntityResponse({ description: 'TRAINING_FULL' })
  enroll(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EnrollEmployeesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EnrollResultDto> {
    return this.service.enroll(id, dto, user);
  }

  @Patch(':id/participants/:employeeId')
  @Roles(...TRAINING_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Ghi kết quả học của một người',
    description:
      '`result` bắt buộc. Bỏ trống `completionDate` thì lấy ngày kết thúc khoá học.',
  })
  @ApiOkResponse({ type: TrainingParticipantDto })
  @ApiNotFoundResponse({ description: 'TRAINING_PARTICIPANT_NOT_FOUND' })
  complete(
    @Param('id', ParseIntPipe) id: number,
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Body() dto: CompleteTrainingDto,
  ): Promise<TrainingParticipantDto> {
    return this.service.complete(id, employeeId, dto);
  }

  @Delete(':id/participants/:employeeId')
  @Roles(...TRAINING_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Gỡ một người khỏi khoá',
    description: 'Chỉ gỡ được khi người đó chưa có kết quả học.',
  })
  @ApiOkResponse({ description: 'id + deleted' })
  @ApiUnprocessableEntityResponse({ description: 'TRAINING_RESULT_RECORDED' })
  unenroll(
    @Param('id', ParseIntPipe) id: number,
    @Param('employeeId', ParseIntPipe) employeeId: number,
  ): Promise<{ id: number; deleted: boolean }> {
    return this.service.unenroll(id, employeeId);
  }
}
