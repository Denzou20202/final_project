import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class UpdatePresenceSettingsDto {
  @ApiProperty({ example: 15, description: 'Через сколько минут бездействия сотрудник авто-переходит в «Неактивен»' })
  @IsInt()
  @Min(1)
  @Max(240)
  inactivityTimeoutMinutes!: number;
}
