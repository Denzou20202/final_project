import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { HEX_COLOR_REGEX } from './create-ticket-type.dto.js';

export class UpdateTicketTypeDto {
  @ApiPropertyOptional({ example: 'Жалоба' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

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

  @ApiPropertyOptional({ example: '#D64545' })
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX, { message: 'Цвет должен быть в формате #RRGGBB' })
  color?: string;

  // true → this type becomes the new default, atomically unsetting whichever
  // row currently holds it. false is only valid when this row isn't the
  // current default (see TicketTypesService.update) — the catalog must
  // always have exactly one default.
  @ApiPropertyOptional({ example: true })
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
