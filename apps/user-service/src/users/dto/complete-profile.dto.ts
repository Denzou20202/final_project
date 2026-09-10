import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { LETTERS_ONLY_PATTERN, PHONE_PATTERN } from './field-patterns.js';

// Backs the mandatory client-onboarding form (client-portal, non-dismissible
// modal shown until UsersService.completeProfile runs once). Unlike
// UpdateUserProfileDto (the admin-facing equivalent, where every field is
// optional), everything here except computerName is genuinely required —
// the first place in the codebase these fields get real "must be filled in"
// validation.
export class CompleteProfileDto {
  @ApiProperty({ description: 'Должность' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(LETTERS_ONLY_PATTERN, { message: 'Только буквы, без цифр и других символов' })
  position!: string;

  @ApiProperty({ description: 'Отдел' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(LETTERS_ONLY_PATTERN, { message: 'Только буквы, без цифр и других символов' })
  department!: string;

  @ApiProperty({ description: 'Компания' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  company!: string;

  @ApiProperty({ description: 'Город' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  city!: string;

  @ApiProperty({ description: 'Телефон' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Matches(PHONE_PATTERN, { message: 'Формат: +380 00 000-00-00' })
  phone!: string;

  // The one field on the client card that stays optional here too —
  // matches UpdateOwnProfileDto's own reasoning for it.
  @ApiPropertyOptional({ description: 'Имя компьютера' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  computerName?: string;
}
