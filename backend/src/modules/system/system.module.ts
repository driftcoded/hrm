import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveTypesModule } from '@/modules/leaves/leave-types.module';
import { BrandingSettingsController } from './branding-settings.controller';
import { BrandingSettingsRepository } from './branding-settings.repository';
import { BrandingSettingsService } from './branding-settings.service';
import { SystemBrandingSettings } from './entities/system-branding-settings.entity';
import { HolidaysModule } from './holidays.module';
import { SystemController } from './system.controller';

/**
 * Holds the `/system/*` lookup endpoints (api-spec.md §20) plus
 * `/settings/branding` (company name/logo/favicon — not in api-spec.md,
 * new feature). No dedicated service/repository for the §20 lookups: every
 * query goes through the service of the module that owns the data.
 */
@Module({
  imports: [
    HolidaysModule,
    LeaveTypesModule,
    TypeOrmModule.forFeature([SystemBrandingSettings]),
  ],
  controllers: [SystemController, BrandingSettingsController],
  providers: [BrandingSettingsService, BrandingSettingsRepository],
})
export class SystemModule {}
