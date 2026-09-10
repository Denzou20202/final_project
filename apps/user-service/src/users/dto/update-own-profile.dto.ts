import { Locale } from '@veloxdesk/types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PHONE_OR_EMPTY_PATTERN } from './field-patterns.js';

// Self-service profile fields — deliberately a small subset of
// UpdateUserProfileDto. position/department/company/city stay organizational
// context entered by an admin (or the onboarding form) and are read-only
// here; computerName and phone are the two fields the person themselves
// actually knows and should be able to keep current (both shown to
// operators on the ticket's client panel, TicketActionsPanel.tsx). locale
// is the interface language, self-service by nature — nobody else should be
// picking it for you.
export class UpdateOwnProfileDto {
  @ApiPropertyOptional({ description: 'Имя компьютера' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  computerName?: string;

  @ApiPropertyOptional({ description: 'Телефон' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(PHONE_OR_EMPTY_PATTERN, { message: 'Формат: +380 00 000-00-00' })
  phone?: string;

  @ApiPropertyOptional({ enum: Locale, description: 'Язык интерфейса' })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;
}
