import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class ConfirmTwoFactorDto {
  @ApiProperty({ description: 'Base32-secret возвращённый /auth/2fa/setup — не хранится сервером до подтверждения' })
  @IsString()
  secret!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  token!: string;
}
