import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({ description: 'Refresh token of the current session to revoke' })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional({ description: 'Revoke all sessions across all devices if true' })
  @IsOptional()
  @IsBoolean()
  allDevices?: boolean;
}
