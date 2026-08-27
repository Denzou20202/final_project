import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignTicketDto {
  @ApiProperty({ description: 'User id of the operator/admin to assign this ticket to' })
  @IsUUID()
  assigneeId!: string;
}
