import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MinLength } from 'class-validator';

export class ResetUserPasswordDto {
  @ApiProperty({ example: 'a-strong-password', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  // Only required/checked when the caller is resetting THEIR OWN password
  // (id === actor.sub in UsersService.resetPasswordByAdmin) — resetting
  // someone else's is the account-recovery path and stays as before.
  @ApiPropertyOptional({ description: 'Required when resetting your own password' })
  @IsOptional()
  @IsString()
  currentPassword?: string;

  // Only required when self-targeting AND the account has 2FA enabled —
  // same re-auth this codebase already requires to disable 2FA
  // (AuthService.disableTwoFactor).
  @ApiPropertyOptional({ description: 'Required when resetting your own password and 2FA is enabled' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  totpCode?: string;
}
