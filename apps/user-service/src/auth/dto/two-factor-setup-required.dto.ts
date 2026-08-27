import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class TwoFactorSetupRequiredDto {
  @ApiProperty({ description: 'setupToken from POST /auth/login when the account\'s group requires 2FA' })
  @IsString()
  @MinLength(1)
  setupToken!: string;
}
