import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetVipDto {
  @ApiProperty({ description: 'true = show a VIP badge next to this client everywhere operators see their name' })
  @IsBoolean()
  isVip!: boolean;
}
