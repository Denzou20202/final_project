import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches, MinLength } from 'class-validator';

export class TwoFactorConfirmRequiredDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  setupToken!: string;

  @ApiProperty({ description: 'Base32-secret returned by /auth/2fa/setup-required' })
  @IsString()
  secret!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  token!: string;
}
