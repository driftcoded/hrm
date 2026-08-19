import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { CalculatePayrollDto } from './dto/calculate-payroll.dto';
import { FilterSalaryDto } from './dto/filter-salary.dto';
import {
  PayrollPeriodSummaryDto,
  SalaryResponseDto,
} from './dto/salary-response.dto';
import { UpdateSalaryDto } from './dto/update-salary.dto';
import { PayrollService, PayrollRunSummary } from './payroll.service';
import { SalariesService } from './salaries.service';

/**
 * Controller CHỈ nhận request / trả response (CLAUDE.md §Kiến trúc module).
 *
 * KHÔNG endpoint nào khai báo `@Roles()`, giống các module khác — nhưng ở đây lý
 * do khác: quyền đọc lương KHÔNG chia theo phạm vi phòng ban mà là được hay
 * không được, và service là nơi giữ ranh giới đó (`PAYROLL_READ_ROLES` /
 * `PAYROLL_WRITE_ROLES`). Đặt `@Roles()` ở đây sẽ tách quy tắc ra hai chỗ.
 *
 * KHÔNG CÓ `GET /salaries/me`. Nhân viên không đăng nhập hệ thống này; phiếu
 * lương cá nhân được nhân sự in ra từ `GET /salaries/:id`.
 */
@ApiTags('Salaries')
@Controller('salaries')
export class SalariesController {
  constructor(
    private readonly salariesService: SalariesService,
    private readonly payrollService: PayrollService,
  ) {}

  @Post('calculate')
  @ApiAuth()
  @ApiOperation({
    summary: 'Tính lương cho một kỳ',
    description:
      'Tính cho TOÀN BỘ nhân viên đang làm việc có hợp đồng còn hiệu lực trong kỳ.\n\n' +
      'Chạy lại được bao nhiêu lần cũng được: dòng `draft`/`calculated` bị ghi đè bằng số mới, dòng `approved`/`paid` được GIỮ NGUYÊN và đếm ở `skippedLocked`.\n\n' +
      '`dryRun: true` chỉ trả thống kê, không ghi gì — nên dùng trước khi chạy thật vì đây là thao tác chạm vào cả công ty và không có nút hoàn tác.',
  })
  @ApiOkResponse({ description: 'Thống kê của lần chạy' })
  @ApiForbiddenResponse({ description: 'FORBIDDEN' })
  @ApiUnprocessableEntityResponse({
    description: 'PAYROLL_NO_WORKING_DAYS – kỳ không có ngày công chuẩn nào',
  })
  calculate(
    @Body() dto: CalculatePayrollDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PayrollRunSummary> {
    return this.payrollService.calculate(dto, user);
  }

  /*
   * Khai báo TRƯỚC `@Get(':id')`. Nest so khớp theo thứ tự khai báo, nên đặt sau
   * thì `summary`/`periods` sẽ rơi vào `:id` và chết ở `ParseIntPipe`.
   */
  @Get('summary')
  @ApiAuth()
  @ApiOperation({
    summary: 'Tổng của một kỳ lương',
    description:
      'Số người, tổng gross/net/bảo hiểm/thuế và số dòng theo trạng thái.',
  })
  @ApiQuery({ name: 'year', example: 2026 })
  @ApiQuery({ name: 'month', example: 8 })
  @ApiOkResponse({ type: PayrollPeriodSummaryDto })
  summary(
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PayrollPeriodSummaryDto> {
    return this.salariesService.summarise(year, month, user);
  }

  @Get('periods')
  @ApiAuth()
  @ApiOperation({
    summary: 'Các kỳ lương đã có dữ liệu',
    description:
      'Để giao diện biết tháng nào chọn được, thay vì cho chọn mọi tháng rồi trả về rỗng.',
  })
  @ApiOkResponse({ description: 'Mảng { year, month }, mới nhất trước' })
  periods(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ year: number; month: number }[]> {
    return this.salariesService.findPeriods(user);
  }

  @Get()
  @ApiAuth()
  @ApiOperation({
    summary: 'Danh sách bảng lương',
    description:
      '`year` BẮT BUỘC — bảng lương là số liệu của một kỳ. Bỏ trống `month` để xem cả năm của một người.',
  })
  @ApiOkResponse({ type: PaginatedResponseDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN' })
  findAll(
    @Query() filter: FilterSalaryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<SalaryResponseDto>> {
    return this.salariesService.findAll(filter, user);
  }

  @Get(':id')
  @ApiAuth()
  @ApiOperation({ summary: 'Chi tiết một phiếu lương' })
  @ApiOkResponse({ type: SalaryResponseDto })
  @ApiNotFoundResponse({ description: 'SALARY_NOT_FOUND' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SalaryResponseDto> {
    return this.salariesService.findOne(id, user);
  }

  @Patch(':id')
  @ApiAuth()
  @ApiOperation({
    summary: 'Chỉnh tay thưởng / thu nhập khác / khấu trừ khác',
    description:
      'CHỈ ba khoản không suy ra được từ dữ liệu gốc. Lương cơ bản, bảo hiểm, thuế và ngày công do server tính từ hợp đồng và chấm công.\n\n' +
      'Sửa xong server TÍNH LẠI thuế và lương thực nhận. Phiếu đã duyệt/đã trả thì không sửa được nữa.',
  })
  @ApiOkResponse({ type: SalaryResponseDto })
  @ApiConflictResponse({ description: 'SALARY_LOCKED' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSalaryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SalaryResponseDto> {
    return this.salariesService.update(id, dto, user);
  }

  @Patch(':id/approve')
  @ApiAuth()
  @ApiOperation({
    summary: 'Duyệt một phiếu lương',
    description:
      'Từ `calculated` sang `approved`. Từ đây phiếu bị khoá: không tính lại, không sửa tay.',
  })
  @ApiOkResponse({ type: SalaryResponseDto })
  @ApiConflictResponse({ description: 'SALARY_NOT_CALCULATED' })
  approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SalaryResponseDto> {
    return this.salariesService.approve(id, user);
  }

  @Patch(':id/mark-paid')
  @ApiAuth()
  @ApiOperation({
    summary: 'Đánh dấu đã trả lương',
    description:
      'Chỉ đi được từ `approved`. Nhảy thẳng từ `calculated` là bỏ mất bước kiểm soát cuối cùng trước khi tiền rời công ty.',
  })
  @ApiOkResponse({ type: SalaryResponseDto })
  @ApiConflictResponse({ description: 'SALARY_NOT_APPROVED' })
  markPaid(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SalaryResponseDto> {
    return this.salariesService.markPaid(id, user);
  }

  @Patch(':id/cancel')
  @ApiAuth()
  @ApiOperation({
    summary: 'Huỷ một phiếu lương',
    description:
      'Đường thoát duy nhất khi phát hiện sai sau khi đã duyệt. Phiếu vẫn nằm lại làm vết; muốn có số mới thì huỷ rồi tính lại.',
  })
  @ApiOkResponse({ type: SalaryResponseDto })
  @ApiConflictResponse({ description: 'SALARY_ALREADY_CANCELLED' })
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SalaryResponseDto> {
    return this.salariesService.cancel(id, user);
  }
}
