import { AuthAudience } from '@veloxdesk/types';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'client@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  password!: string;

  // Which login surface this attempt is from (client-portal vs operator-app
  // "staff" login) — see LoginPage.tsx's `?portal=` param. Determines which
  // LdapConfigEntity/OidcConfigEntity (if any) governs this login; omitted
  // defaults to CLIENT, the more common/public surface.
  @ApiPropertyOptional({ enum: AuthAudience, default: AuthAudience.CLIENT })
  @IsOptional()
  @IsEnum(AuthAudience)
  audience?: AuthAudience;

  // Cloudflare Turnstile response token — only required once
  // LoginLockoutService flags the caller's IP as over its failure
  // threshold (see AuthService.login); absent on every normal login.
  @ApiPropertyOptional({ description: 'Cloudflare Turnstile response token, required only once flagged' })
  @IsOptional()
  @IsString()
  captchaToken?: string;
}
