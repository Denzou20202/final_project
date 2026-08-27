import { UserRole } from '@veloxdesk/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class UpsertOidcConfigDto {
  @ApiProperty({ example: 'https://login.microsoftonline.com/<tenant-id>/v2.0' })
  @IsUrl({ require_tld: false })
  issuerUrl!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  clientId!: string;

  // Optional on update — omit to keep the currently-stored encrypted
  // secret unchanged (the frontend never receives it back to resubmit).
  @ApiPropertyOptional({ description: 'Omit to keep the existing stored secret unchanged' })
  @IsOptional()
  @IsString()
  clientSecret?: string;

  @ApiProperty({ example: 'https://veloxdesk.example.com/auth/oidc/staff/callback' })
  @IsUrl({ require_tld: false })
  redirectUri!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scopes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emailClaim?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullNameClaim?: string;

  @ApiProperty({ enum: UserRole, description: 'Role assigned to a brand-new account on first SSO login' })
  @IsEnum(UserRole)
  defaultRole!: UserRole;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
