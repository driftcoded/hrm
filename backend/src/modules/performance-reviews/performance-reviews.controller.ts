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
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { CreatePerformanceReviewDto } from './dto/create-performance-review.dto';
import { FilterPerformanceReviewDto } from './dto/filter-performance-review.dto';
import { PerformanceReviewResponseDto } from './dto/performance-review-response.dto';
import { UpdatePerformanceReviewDto } from './dto/update-performance-review.dto';
import { PerformanceReviewsService } from './performance-reviews.service';

/**
 * Đánh giá hiệu suất.
 *
 * Không khai `@Roles()` — quyền theo quan hệ với bản ghi, do service quyết định
 * qua `resolveScope`. Không có endpoint "của tôi" vì nhân viên không đăng nhập.
 */
@ApiTags('Performance Reviews')
@Controller('performance-reviews')
export class PerformanceReviewsController {
  constructor(private readonly service: PerformanceReviewsService) {}

  @Post()
  @ApiAuth()
  @ApiOperation({
    summary: 'Tạo một bản đánh giá (nháp)',
    description:
      'Người chấm lấy từ token. `overallScore` và `rating` do server tính, bằng trung bình các tiêu chí đã chấm.\n\n' +
      'Mỗi nhân viên chỉ có một bản cho mỗi kỳ.',
  })
  @ApiCreatedResponse({ type: PerformanceReviewResponseDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN' })
  @ApiConflictResponse({ description: 'REVIEW_PERIOD_TAKEN' })
  @ApiUnprocessableEntityResponse({
    description: 'REVIEW_PERIOD_MISMATCH · REVIEWER_HAS_NO_EMPLOYEE_RECORD',
  })
  create(
    @Body() dto: CreatePerformanceReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PerformanceReviewResponseDto> {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiAuth()
  @ApiOperation({
    summary: 'Danh sách đánh giá',
    description: 'Kỳ mới nhất trước. `manager` chỉ thấy phòng ban mình quản.',
  })
  @ApiOkResponse({ type: PaginatedResponseDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN' })
  findAll(
    @Query() filter: FilterPerformanceReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<PerformanceReviewResponseDto>> {
    return this.service.findAll(filter, user);
  }

  @Get(':id')
  @ApiAuth()
  @ApiOperation({ summary: 'Chi tiết một bản đánh giá' })
  @ApiOkResponse({ type: PerformanceReviewResponseDto })
  @ApiNotFoundResponse({ description: 'REVIEW_NOT_FOUND' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PerformanceReviewResponseDto> {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  @ApiAuth()
  @ApiOperation({
    summary: 'Sửa bản nháp',
    description:
      'Chỉ khi còn `draft`. Sửa một tiêu chí thì điểm tổng và xếp loại được tính lại.',
  })
  @ApiOkResponse({ type: PerformanceReviewResponseDto })
  @ApiConflictResponse({ description: 'REVIEW_NOT_DRAFT' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePerformanceReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PerformanceReviewResponseDto> {
    return this.service.update(id, dto, user);
  }

  @Patch(':id/submit')
  @ApiAuth()
  @ApiOperation({
    summary: 'Chốt bản đánh giá',
    description:
      'Từ `draft` sang `submitted`; sau đó không sửa được nữa. Bản chưa chấm điểm nào thì không chốt được.',
  })
  @ApiOkResponse({ type: PerformanceReviewResponseDto })
  @ApiConflictResponse({ description: 'REVIEW_NOT_DRAFT' })
  @ApiUnprocessableEntityResponse({ description: 'REVIEW_HAS_NO_SCORE' })
  submit(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PerformanceReviewResponseDto> {
    return this.service.submit(id, user);
  }

  @Patch(':id/acknowledge')
  @ApiAuth()
  @ApiOperation({
    summary: 'Ghi nhận nhân viên đã ký nhận',
    description:
      'Thao tác của nhân sự, ghi lại việc ký nhận đã diễn ra trên giấy. Không mở cho `manager`.',
  })
  @ApiOkResponse({ type: PerformanceReviewResponseDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN' })
  @ApiConflictResponse({ description: 'REVIEW_NOT_SUBMITTED' })
  acknowledge(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PerformanceReviewResponseDto> {
    return this.service.acknowledge(id, user);
  }

  @Delete(':id')
  @ApiAuth()
  @ApiOperation({
    summary: 'Xoá bản nháp',
    description: 'Chỉ xoá được bản còn ở trạng thái `draft`.',
  })
  @ApiOkResponse({ description: 'id + deleted' })
  @ApiConflictResponse({ description: 'REVIEW_NOT_DRAFT' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ id: number; deleted: boolean }> {
    return this.service.remove(id, user);
  }
}
