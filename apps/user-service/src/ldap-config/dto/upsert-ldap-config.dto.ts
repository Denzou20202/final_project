import { UserRole } from '@veloxdesk/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class UpsertLdapConfigDto {
  @ApiProperty({ example: 'ldaps://dc01.corp.local:636' })
  @IsUrl({ protocols: ['ldap', 'ldaps'], require_tld: false }, { message: 'url must be a valid ldap:// or ldaps:// URL' })
  url!: string;

  @ApiProperty({ example: 'CN=svc-veloxdesk,OU=Service Accounts,DC=corp,DC=local' })
  @IsString()
  @MinLength(1)
  bindDn!: string;

  // Optional on update — omit to keep the currently-stored encrypted
  // password unchanged (the frontend never receives it back to resubmit).
  @ApiPropertyOptional({ description: 'Omit to keep the existing stored password unchanged' })
  @IsOptional()
  @IsString()
  bindPassword?: string;

  @ApiProperty({ example: 'OU=Staff,DC=corp,DC=local' })
  @IsString()
  @MinLength(1)
  searchBase!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userFilterTemplate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emailAttribute?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullNameAttribute?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalIdAttribute?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  tlsRejectUnauthorized?: boolean;

  @ApiProperty({ enum: UserRole, description: 'Role assigned to a brand-new account on first LDAP login' })
  @IsEnum(UserRole)
  defaultRole!: UserRole;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
