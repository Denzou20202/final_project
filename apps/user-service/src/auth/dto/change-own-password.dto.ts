import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

// totpCode is only actually required when the caller's account has 2FA
// enabled — UsersService.assertSelfReauth checks that live against the
// account, not this DTO (a bare @IsOptional() field can't express "required
// only if...", same reason ResetUserPasswordDto's twin fields are optional
// here too).
export class ChangeOwnPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;

  @ApiPropertyOptional({ example: '123456' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  totpCode?: string;
}
