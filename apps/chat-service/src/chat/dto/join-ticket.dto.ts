import { IsUUID } from 'class-validator';

export class JoinTicketDto {
  @IsUUID()
  ticketId!: string;
}
