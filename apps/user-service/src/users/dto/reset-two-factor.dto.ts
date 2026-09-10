import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

// Both fields only required/checked when the caller is resetting THEIR OWN
// 2FA (id === actor.sub in UsersService.resetTwoFactorByAdmin) — same
// re-auth AuthService.disableTwoFactor already requires for the
// self-service /auth/2fa/disable path. Resetting someone else's 2FA (the
// account-recovery case) needs neither and stays unchanged.
export class ResetTwoFactorDto {
  @ApiPropertyOptional({ description: 'Required when resetting your own 2FA' })
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @ApiPropertyOptional({ description: 'Required when resetting your own 2FA' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  totpCode?: string;
}
