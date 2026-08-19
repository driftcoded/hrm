import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PAYROLL_WRITE_ROLES } from '@/common/constants/roles.constant';
import { ApiAuth } from '@/common/decorators/api-auth.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { toIsoString } from '@/common/utils/date.util';
import {
  PayrollSettingsResponseDto,
  UpdatePayrollSettingsDto,
} from './dto/payroll-settings.dto';
import { PayrollSettings } from './entities/payroll-settings.entity';
import { PayrollSettingsService } from './payroll-settings.service';

/**
 * Cấu hình lương cấp công ty.
 *
 * `@Roles()` dùng được ở đây (khác các controller khác của module) vì cấu hình
 * không thuộc về nhân viên nào — không có phạm vi phòng ban để service phải cân
 * nhắc, chỉ có được sửa hay không.
 */
@ApiTags('Payroll Settings')
@Controller('payroll-settings')
export class PayrollSettingsController {
  constructor(private readonly service: PayrollSettingsService) {}

  @Get()
  @Roles(...PAYROLL_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Đọc cấu hình lương',
    description:
      'Vùng lương tối thiểu (quyết định trần đóng BHTN) và các khoản phụ cấp theo chính sách chung.',
  })
  @ApiOkResponse({ type: PayrollSettingsResponseDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN' })
  async get(): Promise<PayrollSettingsResponseDto> {
    return toResponse(await this.service.getSettings());
  }

  @Patch()
  @Roles(...PAYROLL_WRITE_ROLES)
  @ApiAuth()
  @ApiOperation({
    summary: 'Sửa cấu hình lương',
    description:
      'Chỉ ảnh hưởng tới các kỳ lương TÍNH TỪ NAY — bảng lương đã tính giữ nguyên con số của lúc đó, vì nó là chứng từ.',
  })
  @ApiOkResponse({ type: PayrollSettingsResponseDto })
  async update(
    @Body() dto: UpdatePayrollSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PayrollSettingsResponseDto> {
    const changes: Partial<PayrollSettings> = {};

    if (dto.minimumWageRegion !== undefined) {
      changes.minimumWageRegion = dto.minimumWageRegion;
    }

    if (dto.mealAllowance !== undefined) {
      changes.mealAllowance = dto.mealAllowance.toFixed(2);
    }

    if (dto.transportAllowance !== undefined) {
      changes.transportAllowance = dto.transportAllowance.toFixed(2);
    }

    if (dto.phoneAllowance !== undefined) {
      changes.phoneAllowance = dto.phoneAllowance.toFixed(2);
    }

    if (dto.attendanceAllowance !== undefined) {
      changes.attendanceAllowance = dto.attendanceAllowance.toFixed(2);
    }

    if (dto.payOvertime !== undefined) {
      changes.payOvertime = dto.payOvertime;
    }

    return toResponse(await this.service.update(changes, user));
  }
}

function toResponse(settings: PayrollSettings): PayrollSettingsResponseDto {
  return {
    minimumWageRegion: Number(settings.minimumWageRegion),
    mealAllowance: Number(settings.mealAllowance),
    transportAllowance: Number(settings.transportAllowance),
    phoneAllowance: Number(settings.phoneAllowance),
    attendanceAllowance: Number(settings.attendanceAllowance),
    payOvertime: settings.payOvertime,
    updatedAt: toIsoString(settings.updatedAt),
  };
}
