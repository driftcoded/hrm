import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthenticatedUser } from '@/common/types/authenticated-user';
import { PayrollSettings } from './entities/payroll-settings.entity';

/** Bảng cấu hình chỉ có một dòng, `id` cố định bằng 1 (CHECK ở migration). */
const SETTINGS_ID = 1;

/**
 * Cấu hình lương cấp công ty.
 *
 * Cùng khuôn với `BrandingSettingsService`: một dòng duy nhất, được migration
 * chèn sẵn nên `getSettings()` không bao giờ trả `null` và không có đường nào
 * tạo dòng thứ hai.
 */
@Injectable()
export class PayrollSettingsService {
  private readonly logger = new Logger(PayrollSettingsService.name);

  constructor(
    @InjectRepository(PayrollSettings)
    private readonly repository: Repository<PayrollSettings>,
  ) {}

  async getSettings(): Promise<PayrollSettings> {
    const settings = await this.repository.findOne({
      where: { id: SETTINGS_ID },
    });

    if (!settings) {
      /*
       * Migration đã chèn dòng này. Thiếu nó nghĩa là ai đó xoá tay trong DB —
       * dựng lại bằng mặc định an toàn hơn là để cả phân hệ lương chết.
       */
      this.logger.warn(
        'payroll_settings row is missing; recreating it with defaults',
      );

      return this.repository.save(
        this.repository.create({
          id: SETTINGS_ID,
          minimumWageRegion: 1,
          mealAllowance: '730000.00',
          transportAllowance: '0.00',
          phoneAllowance: '0.00',
          attendanceAllowance: '0.00',
          payOvertime: true,
        }),
      );
    }

    return settings;
  }

  async update(
    changes: Partial<PayrollSettings>,
    user: AuthenticatedUser,
  ): Promise<PayrollSettings> {
    const settings = await this.getSettings();

    Object.assign(settings, changes, {
      id: SETTINGS_ID,
      updatedBy: user.userId,
    });

    const saved = await this.repository.save(settings);

    this.logger.log(`Payroll settings updated by user ${user.userId}`);

    return saved;
  }
}
