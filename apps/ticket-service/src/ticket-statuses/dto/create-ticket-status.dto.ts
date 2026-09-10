import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export class CreateTicketStatusDto {
  @ApiProperty({ example: 'На согласовании' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  // Auto-filled via DeepL as the admin types `name`, editable before save —
  // never machine-translated server-side, this just persists whatever the
  // form already resolved. No MinLength — an admin may leave either blank.
  @ApiPropertyOptional({ example: 'На узгодженні' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nameUk?: string;

  @ApiPropertyOptional({ example: 'Pending approval' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nameEn?: string;

  @ApiProperty({ example: '#7C6FE0' })
  @IsString()
  @Matches(HEX_COLOR_REGEX, { message: 'Цвет должен быть в формате #RRGGBB' })
  color!: string;

  // Omitted/false on create — a brand-new status never silently steals
  // "default for new tickets" from whichever status already holds it.
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  tracksSla?: boolean;
}
