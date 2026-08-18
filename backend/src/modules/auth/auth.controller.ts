import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { AuthService, RequestContext } from './auth.service';
import {
  AuthActionResponseDto,
  AuthUserDto,
  LoginResponseDto,
  RefreshResponseDto,
} from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RefreshCookieService } from './refresh-cookie.service';
import { ResetPasswordDto } from './dto/reset-password.dto';

/**
 * Controller CHỈ điều phối request/response + cookie (transport), toàn bộ
 * business logic nằm ở AuthService (CLAUDE.md §Kiến trúc module).
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly refreshCookieService: RefreshCookieService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Đăng nhập (username HOẶC email) – trả access token + set cookie refresh token',
    description:
      'Refresh token được set trong cookie HttpOnly; SameSite=Strict; Secure (chỉ production) và KHÔNG có trong body.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'INVALID_CREDENTIALS' })
  @ApiResponse({
    status: 423,
    description: 'ACCOUNT_LOCKED – đang bị khoá, kèm thời gian còn lại',
  })
  @ApiResponse({
    status: 429,
    description: 'ACCOUNT_LOCKED – lần sai thứ 5 làm khoá tài khoản 15 phút',
  })
  async login(
    @Body() dto: LoginUserDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.login(dto, requestContext(request));

    this.refreshCookieService.set(
      response,
      result.refresh.token,
      result.refresh.persistent,
      result.refresh.maxAgeMs,
    );

    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cấp access token mới từ cookie refresh token (có rotation)',
    description:
      'Không nhận body: token đọc từ cookie HttpOnly. Token cũ bị revoke ngay; dùng lại token đã revoke sẽ revoke toàn bộ session của user.',
  })
  @ApiOkResponse({ type: RefreshResponseDto })
  @ApiUnauthorizedResponse({
    description: 'TOKEN_INVALID / REFRESH_TOKEN_EXPIRED',
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshResponseDto> {
    const rawToken = this.refreshCookieService.read(request);
    const result = await this.authService.refresh(
      rawToken,
      requestContext(request),
    );

    this.refreshCookieService.set(
      response,
      result.refresh.token,
      result.refresh.persistent,
      result.refresh.maxAgeMs,
    );

    return { accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiAuth()
  @ApiOperation({
    summary: 'Đăng xuất – revoke refresh token trong DB + xoá cookie',
    description:
      'Session được xác định qua claim `sid` của access token, KHÔNG qua cookie: cookie refresh token chỉ được browser gửi tới /auth/refresh (path hẹp).',
  })
  @ApiOkResponse({ type: AuthActionResponseDto })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthActionResponseDto> {
    await this.authService.logout(user.userId, user.sessionId);
    this.refreshCookieService.clear(response);

    return { ok: true };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiAuth()
  @ApiOperation({
    summary: 'Đổi mật khẩu – thành công sẽ revoke toàn bộ session của user',
  })
  @ApiOkResponse({ type: AuthActionResponseDto })
  @ApiBadRequestResponse({
    description: 'PASSWORD_MISMATCH / VALIDATION_ERROR',
  })
  @ApiUnauthorizedResponse({ description: 'WRONG_CURRENT_PASSWORD' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthActionResponseDto> {
    await this.authService.changePassword(user.userId, dto);
    // Mọi refresh token đã bị revoke → cookie hiện tại vô nghĩa, xoá luôn.
    this.refreshCookieService.clear(response);

    return { ok: true };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Gửi email chứa link đặt lại mật khẩu (hiệu lực 30 phút)',
    description:
      'Luôn trả về cùng một response dù email có tồn tại hay không (chống user enumeration).',
  })
  @ApiOkResponse({ type: AuthActionResponseDto })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<AuthActionResponseDto> {
    await this.authService.forgotPassword(dto);

    return { ok: true };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đặt mật khẩu mới bằng token từ email (token dùng một lần)',
  })
  @ApiOkResponse({ type: AuthActionResponseDto })
  @ApiBadRequestResponse({
    description:
      'RESET_TOKEN_INVALID / RESET_TOKEN_EXPIRED / PASSWORD_MISMATCH',
  })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<AuthActionResponseDto> {
    await this.authService.resetPassword(dto);

    return { ok: true };
  }

  @Get('me')
  @ApiAuth()
  @ApiOperation({
    summary: 'Thông tin user đang đăng nhập',
    description:
      'Bổ sung ngoài api-spec.md §2: frontend giữ access token trong memory nên sau F5 sẽ gọi /auth/refresh rồi /auth/me để dựng lại session.',
  })
  @ApiOkResponse({ type: AuthUserDto })
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<AuthUserDto> {
    return this.authService.getProfile(user.userId);
  }
}

function requestContext(request: Request): RequestContext {
  const userAgent = request.headers['user-agent'];

  return {
    ipAddress: request.ip ?? null,
    userAgent: typeof userAgent === 'string' ? userAgent : null,
  };
}
