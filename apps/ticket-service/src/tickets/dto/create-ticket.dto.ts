import { TicketPriority } from '@veloxdesk/types';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateTicketDto {
  @ApiProperty({ example: 'Не приходит подтверждение заказа' })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiProperty({ example: 'Оформил заказ №1234, письмо с подтверждением не пришло' })
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiPropertyOptional({ enum: TicketPriority, default: TicketPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  // Admin-managed catalog pick (see GET /ticket-types) — defaults to
  // whichever type is currently flagged isDefault when omitted (see
  // TicketsService.create).
  @ApiPropertyOptional({ description: 'Ticket type id (see GET /ticket-types)' })
  @IsOptional()
  @IsUUID()
  typeId?: string;

  // Staff-only (operators/admins) — the client this ticket is being logged
  // for, e.g. after a phone call. Ignored if the requester is a client
  // themselves (see TicketsService.create).
  @ApiPropertyOptional({ description: 'Client user id — staff creating a ticket on a client\'s behalf' })
  @IsOptional()
  @IsUUID()
  onBehalfOf?: string;

  // «Категория проблемы» — optional at creation for every role (client or
  // staff on their behalf); see TicketCategoriesModule for the admin-managed
  // catalog this must reference.
  @ApiPropertyOptional({ description: 'Ticket category id (see GET /ticket-categories)' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
