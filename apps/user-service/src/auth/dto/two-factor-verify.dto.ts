import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches, MinLength } from 'class-validator';

export class TwoFactorVerifyDto {
  @ApiProperty({ description: 'challengeToken from POST /auth/login' })
  @IsString()
  @MinLength(1)
  challengeToken!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  token!: string;
}
