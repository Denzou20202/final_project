import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { HEX_COLOR_REGEX } from './create-employee-status.dto.js';

export class UpdateEmployeeStatusDto {
  @ApiPropertyOptional({ example: 'На обеде' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

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

  @ApiPropertyOptional({ example: '#F59E0B' })
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX, { message: 'Цвет должен быть в формате #RRGGBB' })
  color?: string;
}
