import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { ROLE_ADMIN } from '@/common/constants/roles.constant';
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { MailSettingsResponseDto } from './dto/mail-settings-response.dto';
import { TestMailDto } from './dto/test-mail.dto';
import { TestMailResponseDto } from './dto/test-mail-response.dto';
import { UpdateMailSettingsDto } from './dto/update-mail-settings.dto';
import { MailSettingsService } from './mail-settings.service';

/**
 * CHỈ `admin` được xem/sửa (chứa mật khẩu SMTP, dù đã mã hoá trong DB) —
 * nhạy cảm hơn hẳn master data thường nên không dùng `MASTER_DATA_WRITE_ROLES`.
 * Không có `@Public()` ở đâu trong controller này.
 */
@ApiTags('Settings')
@Controller('settings/mail')
export class MailSettingsController {
  constructor(private readonly mailSettingsService: MailSettingsService) {}

  @Get()
  @Roles(ROLE_ADMIN)
  @ApiAuth()
  @ApiOperation({
    summary: 'Cấu hình SMTP hiện tại',
    description: 'KHÔNG trả mật khẩu thật, chỉ `hasPassword: boolean`.',
  })
  @ApiOkResponse({ type: MailSettingsResponseDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – chỉ admin' })
  get(): Promise<MailSettingsResponseDto> {
    return this.mailSettingsService.getForAdmin();
  }

  @Patch()
  @Roles(ROLE_ADMIN)
  @ApiAuth()
  @ApiOperation({
    summary: 'Cập nhật cấu hình SMTP',
    description: 'Bỏ trống `smtpPassword` = giữ nguyên mật khẩu đã lưu.',
  })
  @ApiOkResponse({ type: MailSettingsResponseDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – chỉ admin' })
  update(
    @Body() dto: UpdateMailSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MailSettingsResponseDto> {
    return this.mailSettingsService.update(dto, user.userId);
  }

  @Post('test')
  @Roles(ROLE_ADMIN)
  @ApiAuth()
  @ApiOperation({
    summary: 'Gửi email thử bằng cấu hình ĐANG LƯU trong DB',
    description:
      'Dùng để kiểm chứng SMTP hoạt động trước khi đưa vào production, không phụ thuộc MAIL_TRANSPORT hiện tại của app.',
  })
  @ApiOkResponse({ type: TestMailResponseDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – chỉ admin' })
  @ApiUnprocessableEntityResponse({ description: 'MAIL_SETTINGS_INCOMPLETE' })
  sendTest(@Body() dto: TestMailDto): Promise<TestMailResponseDto> {
    return this.mailSettingsService.sendTest(dto.to);
  }
}
