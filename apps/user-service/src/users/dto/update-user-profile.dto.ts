import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { LETTERS_ONLY_OR_EMPTY_PATTERN, PHONE_OR_EMPTY_PATTERN } from './field-patterns.js';

// Organizational context about the person, entered by an admin — see
// UserEntity for why this is separate from the `teams` (routing) entity.
// Every field but fullName is nullable on the entity; an empty string here
// is treated the same as "clear the field" (service coerces '' to null).
export class UpdateUserProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName?: string;

  @ApiPropertyOptional({ description: 'Имя компьютера' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  computerName?: string;

  @ApiPropertyOptional({ description: 'Должность' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(LETTERS_ONLY_OR_EMPTY_PATTERN, { message: 'Только буквы, без цифр и других символов' })
  position?: string;

  @ApiPropertyOptional({ description: 'Отдел' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(LETTERS_ONLY_OR_EMPTY_PATTERN, { message: 'Только буквы, без цифр и других символов' })
  department?: string;

  @ApiPropertyOptional({ description: 'Компания' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  company?: string;

  @ApiPropertyOptional({ description: 'Город' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  city?: string;

  @ApiPropertyOptional({ description: 'Телефон' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(PHONE_OR_EMPTY_PATTERN, { message: 'Формат: +380 00 000-00-00' })
  phone?: string;
}
