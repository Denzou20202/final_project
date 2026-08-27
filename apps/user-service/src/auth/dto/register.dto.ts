import { ApiProperty } from '@nestjs/swagger';
import { Locale } from '@veloxdesk/types';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'client@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'a-strong-password', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Ivan Petrov' })
  @IsString()
  @MinLength(1)
  fullName!: string;

  // Whatever language the registration form itself was filled out in — see
  // AuthService.register. Optional so older/other clients calling this
  // endpoint without it still fall back to the entity column's own default.
  @ApiProperty({ enum: Locale, required: false })
  @IsOptional()
  @IsEnum(Locale)
  locale?: Locale;

  // Cloudflare Turnstile response token from the registration form's
  // always-on widget — see TurnstileService.verify. Registration has no
  // "below threshold, skip it" case the way login does, so this is
  // unconditionally required.
  @ApiProperty({ description: 'Cloudflare Turnstile response token' })
  @IsString()
  captchaToken!: string;
}
