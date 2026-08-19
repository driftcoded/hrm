import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { EMPLOYEE_WRITE_ROLES } from '@/common/constants/roles.constant';
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { PaginatedResponseDto } from '@/common/dto/pagination-response.dto';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import {
  buildContentDisposition,
  toAsciiFilename,
  XLSX_CONTENT_TYPE,
} from '@/modules/reports/utils/excel.util';
import { UploadedFileLike } from '@/shared/storage/image-file.util';
import { AttendanceImportService } from './attendance-import.service';
import { buildImportTemplate } from './attendance-template.util';
import { AttendancesService } from './attendances.service';
import {
  AttendanceResponseDto,
  MyAttendanceResponseDto,
} from './dto/attendance-response.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { FilterAttendanceDto } from './dto/filter-attendance.dto';
import { ImportQueryDto } from './dto/import-query.dto';
import { AttendanceImportResultDto } from './dto/import-attendance.dto';
import { MonthQueryDto } from './dto/month-query.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

/**
 * Trần cứng của multer cho file import.
 *
 * KHÔNG phải giới hạn nghiệp vụ — giới hạn thật là số DÒNG
 * (`AttendanceImportService.MAX_IMPORT_ROWS`), vì một file 20.000 dòng vẫn nhỏ
 * còn một file 5MB có thể chỉ chứa ảnh nhúng. Trần này chỉ để một request
 * khổng lồ không nuốt hết RAM trước khi tới được tầng service.
 */
export const IMPORT_MULTER_HARD_LIMIT_BYTES = 15 * 1024 * 1024;

/**
 * Controller CHỈ nhận request / trả response (CLAUDE.md §Kiến trúc module).
 *
 * `check-in`, `check-out` và `/me` KHÔNG khai báo `@Roles()`: mọi vai trò đều
 * tự chấm công và xem bảng công của mình. `GET /attendances` cũng không khai
 * báo — phạm vi dữ liệu do service quyết định theo hồ sơ nhân viên
 * (`resolveScope`), giống `/contracts`. Chỉ `PATCH` mới có `@Roles()` vì sửa
 * bảng chấm công là sửa căn cứ trả lương.
 */
@ApiTags('Attendances')
@Controller('attendances')
export class AttendancesController {
  constructor(
    private readonly attendancesService: AttendancesService,
    private readonly attendanceImportService: AttendanceImportService,
  ) {}

  @Post('check-in')
  @ApiAuth()
  @ApiOperation({
    summary: 'Chấm công vào',
    description:
      'Ghi giờ vào cho CHÍNH người đang đăng nhập, giờ do server đọc theo múi giờ Việt Nam. ' +
      'Chấm lần thứ hai trong ngày trả 409 — lần đầu là lần được tính (PLAN 4.1).',
  })
  @ApiCreatedResponse({ type: AttendanceResponseDto })
  @ApiConflictResponse({ description: 'ALREADY_CHECKED_IN' })
  checkIn(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckInDto,
  ): Promise<AttendanceResponseDto> {
    return this.attendancesService.checkIn(user, dto);
  }

  @Post('check-out')
  @ApiAuth()
  @ApiOperation({
    summary: 'Chấm công ra',
    description:
      'Ghi giờ ra và tính giờ công (đã trừ 60 phút nghỉ trưa), đi muộn, về sớm. ' +
      'Chưa chấm vào thì trả 404 NOT_CHECKED_IN chứ không đoán hộ giờ vào.',
  })
  @ApiOkResponse({ type: AttendanceResponseDto })
  @ApiNotFoundResponse({ description: 'NOT_CHECKED_IN' })
  @ApiConflictResponse({ description: 'ALREADY_CHECKED_OUT' })
  checkOut(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckOutDto,
  ): Promise<AttendanceResponseDto> {
    return this.attendancesService.checkOut(user, dto);
  }

  @Get('me')
  @ApiAuth()
  @ApiOperation({
    summary: 'Bảng chấm công tháng của chính mình',
    description:
      'Mặc định là tháng hiện tại. Trả về `summary` (ngày công, đi muộn, vắng, giờ làm thêm) và `records`.\n\n' +
      '`summary.overtimeHours` là số giờ đã ở lại làm THỰC TẾ; `summary.approvedOvertimeHours` mới là số giờ được trả tiền.',
  })
  @ApiOkResponse({ type: MyAttendanceResponseDto })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: MonthQueryDto,
  ): Promise<MyAttendanceResponseDto> {
    return this.attendancesService.findMine(user, query);
  }

  /*
   * Khai báo TRƯỚC `@Get(':id')`. Nest so khớp theo thứ tự khai báo, nên đặt
   * sau thì `import-template` sẽ rơi vào `:id` và chết ở `ParseIntPipe`.
   */
  @Get('import-template')
  @Roles(...EMPLOYEE_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Tải file Excel mẫu để nhập chấm công',
    description:
      'Cách hỏng phổ biến nhất của import là file đúng dữ liệu nhưng sai tiêu đề cột. ' +
      'File mẫu có sẵn 2 dòng ví dụ, trong đó một dòng chỉ có giờ vào — trường hợp quên chấm ra là HỢP LỆ.',
  })
  @ApiProduces(XLSX_CONTENT_TYPE)
  @ApiOkResponse({
    description: 'File .xlsx',
    schema: { type: 'string', format: 'binary' },
  })
  async downloadImportTemplate(@Res() response: Response): Promise<void> {
    const buffer = Buffer.from(await buildImportTemplate().xlsx.writeBuffer());
    const utf8Filename = 'Mau nhap cham cong.xlsx';
    const filename = toAsciiFilename(utf8Filename);

    response.setHeader('Content-Type', XLSX_CONTENT_TYPE);
    response.setHeader(
      'Content-Disposition',
      buildContentDisposition(filename, 'Mẫu nhập chấm công.xlsx'),
    );
    response.setHeader('Content-Length', buffer.length);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.end(buffer);
  }

  @Post('bulk-import')
  @Roles(...EMPLOYEE_WRITE_ROLES)
  @ApiAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: IMPORT_MULTER_HARD_LIMIT_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: 'Nhập chấm công từ file Excel (.xlsx)',
    description:
      '**TẤT CẢ HOẶC KHÔNG GÌ CẢ**: chỉ cần một dòng sai là KHÔNG dòng nào được ghi, và toàn bộ lỗi được trả về kèm số dòng trong file. ' +
      'Nhập một phần sẽ để lại một tháng công nửa vời mà không ai biết thiếu ngày nào — và bảng công thiếu ngày trông y hệt bảng công đủ.\n\n' +
      '`?dryRun=true` chỉ kiểm tra, không ghi gì. Màn hình import gọi bước này trước.\n\n' +
      'Cột bắt buộc: `Mã NV`, `Ngày`, `Giờ vào`. Tuỳ chọn: `Giờ ra`, `Ghi chú`. Tiêu đề so khớp không phân biệt hoa thường và dấu.\n\n' +
      'Bản ghi ghi ĐÈ lên ngày công đã có được đếm riêng ở `updated` — luôn trả về để không ai vô tình sửa dữ liệu cũ mà không biết.',
  })
  @ApiCreatedResponse({ type: AttendanceImportResultDto })
  @ApiBadRequestResponse({
    description:
      'IMPORT_FILE_REQUIRED / IMPORT_INVALID_FILE_TYPE / IMPORT_MISSING_COLUMNS / IMPORT_TOO_MANY_ROWS',
  })
  bulkImport(
    @UploadedFile() file: UploadedFileLike | undefined,
    @Query() query: ImportQueryDto,
  ): Promise<AttendanceImportResultDto> {
    return this.attendanceImportService.importFromFile(file, {
      dryRun: query.dryRun === true,
    });
  }

  @Get()
  @ApiAuth()
  @ApiOperation({
    summary: 'Danh sách chấm công toàn công ty',
    description:
      'Lọc theo `employeeId`, `departmentId`, `month`+`year`, `status`. ' +
      '`manager` chỉ thấy phòng ban mình quản; nhân viên thường nhận 403 và phải dùng `/attendances/me`.',
  })
  @ApiOkResponse({ type: PaginatedResponseDto })
  @ApiForbiddenResponse({
    description: 'FORBIDDEN – nhân viên thường không xem được danh sách chung',
  })
  findAll(
    @Query() filter: FilterAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<AttendanceResponseDto>> {
    return this.attendancesService.findAll(filter, user);
  }

  @Get(':id')
  @ApiAuth()
  @ApiOperation({ summary: 'Chi tiết một bản ghi chấm công' })
  @ApiOkResponse({ type: AttendanceResponseDto })
  @ApiNotFoundResponse({ description: 'ATTENDANCE_NOT_FOUND' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AttendanceResponseDto> {
    return this.attendancesService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(...EMPLOYEE_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Điều chỉnh chấm công (máy lỗi, quên chấm)',
    description:
      'Chỉ nhóm HR. `note` BẮT BUỘC — bản ghi phải tự nói được vì sao nó khác với thứ máy đã ghi.\n\n' +
      'Sửa giờ thì giờ công, đi muộn, về sớm được TÍNH LẠI; không có chuyện giờ mới đi với số cũ.',
  })
  @ApiOkResponse({ type: AttendanceResponseDto })
  @ApiNotFoundResponse({ description: 'ATTENDANCE_NOT_FOUND' })
  @ApiConflictResponse({
    description: 'INVALID_ATTENDANCE_TIMES – giờ ra sớm hơn giờ vào',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AttendanceResponseDto> {
    return this.attendancesService.update(id, dto, user);
  }
}
