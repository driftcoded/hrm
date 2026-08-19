import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ROLE_ADMIN } from '@/common/constants/roles.constant';
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { UploadedFileLike } from '@/shared/storage/image-file.util';
import { BrandingSettingsService } from './branding-settings.service';
import { BrandingSettingsResponseDto } from './dto/branding-settings-response.dto';
import { UpdateBrandingSettingsDto } from './dto/update-branding-settings.dto';

/** Trần cứng của multer cho logo/favicon — xem employees.controller.ts cho lý do tách khỏi giới hạn nghiệp vụ 2MB. */
const BRANDING_ASSET_MULTER_HARD_LIMIT_BYTES = 10 * 1024 * 1024;

/**
 * `GET` công khai (trang /login cần đọc tên công ty/logo trước khi đăng
 * nhập). Mọi thao tác ghi CHỈ `admin` — đây là cấu hình toàn hệ thống, không
 * dùng `MASTER_DATA_WRITE_ROLES` như phòng ban/chức vụ.
 */
@ApiTags('Settings')
@Controller('settings/branding')
export class BrandingSettingsController {
  constructor(
    private readonly brandingSettingsService: BrandingSettingsService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Tên công ty/logo/favicon hiện tại (public)' })
  @ApiOkResponse({ type: BrandingSettingsResponseDto })
  get(): Promise<BrandingSettingsResponseDto> {
    return this.brandingSettingsService.get();
  }

  @Patch()
  @Roles(ROLE_ADMIN)
  @ApiAuth()
  @ApiOperation({ summary: 'Đổi tên công ty' })
  @ApiOkResponse({ type: BrandingSettingsResponseDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – chỉ admin' })
  updateCompanyName(
    @Body() dto: UpdateBrandingSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BrandingSettingsResponseDto> {
    return this.brandingSettingsService.updateCompanyName(dto, user.userId);
  }

  @Post('logo')
  @Roles(ROLE_ADMIN)
  @ApiAuth()
  @UseInterceptors(
    FileInterceptor('logo', {
      limits: { fileSize: BRANDING_ASSET_MULTER_HARD_LIMIT_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { logo: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload logo (JPEG/PNG/WEBP, tối đa 2MB)' })
  @ApiOkResponse({ type: BrandingSettingsResponseDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – chỉ admin' })
  uploadLogo(
    @UploadedFile() file: UploadedFileLike | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BrandingSettingsResponseDto> {
    return this.brandingSettingsService.uploadLogo(file, user.userId);
  }

  @Delete('logo')
  @Roles(ROLE_ADMIN)
  @ApiAuth()
  @ApiOperation({ summary: 'Xoá logo, quay về mặc định' })
  @ApiOkResponse({ type: BrandingSettingsResponseDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – chỉ admin' })
  removeLogo(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BrandingSettingsResponseDto> {
    return this.brandingSettingsService.removeLogo(user.userId);
  }

  @Post('favicon')
  @Roles(ROLE_ADMIN)
  @ApiAuth()
  @UseInterceptors(
    FileInterceptor('favicon', {
      limits: { fileSize: BRANDING_ASSET_MULTER_HARD_LIMIT_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { favicon: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload favicon (JPEG/PNG/WEBP, tối đa 2MB)' })
  @ApiOkResponse({ type: BrandingSettingsResponseDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – chỉ admin' })
  uploadFavicon(
    @UploadedFile() file: UploadedFileLike | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BrandingSettingsResponseDto> {
    return this.brandingSettingsService.uploadFavicon(file, user.userId);
  }

  @Delete('favicon')
  @Roles(ROLE_ADMIN)
  @ApiAuth()
  @ApiOperation({ summary: 'Xoá favicon, quay về mặc định' })
  @ApiOkResponse({ type: BrandingSettingsResponseDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN – chỉ admin' })
  removeFavicon(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BrandingSettingsResponseDto> {
    return this.brandingSettingsService.removeFavicon(user.userId);
  }
}
