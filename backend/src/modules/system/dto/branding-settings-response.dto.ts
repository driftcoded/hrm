import { ApiProperty } from '@nestjs/swagger';

/** Shape trả về của `/settings/branding` — công khai, không lộ `updatedBy`. */
export class BrandingSettingsResponseDto {
  @ApiProperty({ example: 'HRM' })
  companyName: string;

  @ApiProperty({ example: null, nullable: true, type: String })
  logoUrl: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  faviconUrl: string | null;

  @ApiProperty({ example: '2026-08-19T02:00:00.000Z' })
  updatedAt: string;
}
