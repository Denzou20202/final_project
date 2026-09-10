import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class UpdateStatusDto {
  @ApiProperty({ description: 'Target ticket_statuses row id' })
  @IsUUID('4')
  statusId!: string;
}
