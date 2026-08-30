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
 * ONLY `admin` may view/edit this (it holds the SMTP password, even though
 * it's encrypted in the DB) — far more sensitive than regular master data,
 * so `MASTER_DATA_WRITE_ROLES` is not used here.
 * No `@Public()` anywhere in this controller.
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
