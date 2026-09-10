import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignTeamDto {
  @ApiProperty({ description: 'Team id to assign this ticket to' })
  @IsUUID()
  teamId!: string;
}
