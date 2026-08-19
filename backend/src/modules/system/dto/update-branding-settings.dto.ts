import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** `PATCH /settings/branding` — chỉ đổi tên công ty; logo/favicon có endpoint upload riêng. */
export class UpdateBrandingSettingsDto {
  @ApiProperty({ example: 'Công ty TNHH ABC', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  companyName: string;
}
