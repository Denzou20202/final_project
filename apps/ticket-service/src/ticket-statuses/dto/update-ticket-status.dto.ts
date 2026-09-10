import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { HEX_COLOR_REGEX } from './create-ticket-status.dto.js';

export class UpdateTicketStatusDto {
  @ApiPropertyOptional({ example: 'На согласовании' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

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

  @ApiPropertyOptional({ example: '#7C6FE0' })
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX, { message: 'Цвет должен быть в формате #RRGGBB' })
  color?: string;

  // true → this status becomes the new default, atomically unsetting
  // whichever row currently holds it. false is only valid when this row
  // isn't the current default (see TicketStatusesService.update) — the
  // catalog must always have exactly one default.
  @ApiPropertyOptional({ example: true })
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
