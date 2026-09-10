import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export class CreateTicketTypeDto {
  @ApiProperty({ example: 'Жалоба' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  // Auto-filled via DeepL as the admin types `name`, editable before save —
  // never machine-translated server-side, this just persists whatever the
  // form already resolved. No MinLength — an admin may leave either blank.
  @ApiPropertyOptional({ example: 'Скарга' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nameUk?: string;

  @ApiPropertyOptional({ example: 'Complaint' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nameEn?: string;

  @ApiProperty({ example: '#D64545' })
  @IsString()
  @Matches(HEX_COLOR_REGEX, { message: 'Цвет должен быть в формате #RRGGBB' })
  color!: string;

  // Omitted/false on create — a brand-new type never silently steals
  // "default for new tickets" from whichever type already holds it.
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ example: 1, description: 'Report builder weighted-KPI multiplier — 1 is neutral' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  weight?: number;
}
