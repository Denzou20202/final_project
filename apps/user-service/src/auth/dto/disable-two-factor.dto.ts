import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches, MinLength } from 'class-validator';

export class DisableTwoFactorDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  token!: string;
}
