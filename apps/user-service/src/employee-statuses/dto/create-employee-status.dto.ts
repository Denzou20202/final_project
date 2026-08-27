import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export class CreateEmployeeStatusDto {
  @ApiProperty({ example: 'На обеде' })
  @IsString()
  @MinLength(2)
  name!: string;

  // Auto-filled via DeepL as the admin types `name`, editable before save.
  @ApiPropertyOptional({ example: 'На обіді' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nameUk?: string;

  @ApiPropertyOptional({ example: 'At lunch' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nameEn?: string;

  @ApiProperty({ example: '#F59E0B' })
  @IsString()
  @Matches(HEX_COLOR_REGEX, { message: 'Цвет должен быть в формате #RRGGBB' })
  color!: string;
}
