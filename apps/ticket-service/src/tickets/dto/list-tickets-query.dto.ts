import { SortOrder, TicketPriority, TicketSortField } from '@veloxdesk/types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

// A real operator UUID, or one of two literal sentinels: "no assignee at
// all" (backs the sidebar's «Неприсвоенные» folder) or "has some assignee,
// don't care who" (backs the status folders — see tickets.repository.ts's
// findPage/getCounts, which special-case both into IS NULL / IS NOT NULL
// checks instead of an equality match). Without the "assigned" sentinel, a
// freshly created ticket (status=open, no assignee yet) would show up in
// both «Неприсвоенные» AND the «В работе» status folder at once — the
// status folders are meant to be an assigned-tickets workflow view,
// disjoint from «Неприсвоенные», which is what replaced the old NEW status
// as the "not yet picked up" bucket (see the DropNewTicketStatus migration).
const ASSIGNED_TO_PATTERN = /^unassigned$|^assigned$|^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export class ListTicketsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by ticket_statuses row id' })
  @IsOptional()
  @IsUUID('4')
  statusId?: string;

  @ApiPropertyOptional({ enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({
    description: 'Filter by assigned operator id, "unassigned" for no assignee, or "assigned" for any assignee',
  })
  @IsOptional()
  @Matches(ASSIGNED_TO_PATTERN)
  assignedTo?: string;

  @ApiPropertyOptional({ description: 'Filter by team/department id' })
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiPropertyOptional({ description: 'Filter by tag id' })
  @IsOptional()
  @IsUUID()
  tagId?: string;

  // Only "me" is accepted — the service resolves it to actor.sub. There's
  // no way to ask "who's watching someone else's tickets" through this
  // endpoint; that's not a feature, it'd just be a subscription-info leak.
  @ApiPropertyOptional({ enum: ['me'], description: 'Filter to tickets the current user is watching' })
  @IsOptional()
  @IsIn(['me'])
  watching?: 'me';

  // Same "me"-only reasoning as watching above — bypasses department/own-
  // tickets restrictions on purpose (see TicketsService.list) since being
  // @mentioned is itself the grant.
  @ApiPropertyOptional({ enum: ['me'], description: 'Filter to tickets the current user has been @mentioned on' })
  @IsOptional()
  @IsIn(['me'])
  mentioned?: 'me';

  // Operator/admin only in practice — the service always overrides this to
  // actor.sub for the client role (see TicketsService.list), so a client
  // passing a different id here has no effect.
  @ApiPropertyOptional({ description: 'Filter by ticket creator id (operator/admin only)' })
  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @ApiPropertyOptional({ description: 'Quick search: ticket number (#42 or 42), client name, or subject words' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: 'Only tickets created on/after this instant (inclusive)' })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({ description: 'Only tickets created on/before this instant (inclusive)' })
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @ApiPropertyOptional({ enum: TicketSortField, default: TicketSortField.CREATED_AT })
  @IsOptional()
  @IsEnum(TicketSortField)
  sortBy?: TicketSortField;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;

  // 250 matches the ticket list's largest page-size option (see
  // PAGE_SIZE_OPTIONS in the frontend's ticket-table.store.ts).
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 250 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(250)
  limit?: number;

  @ApiPropertyOptional({ description: 'Opaque cursor from the previous page\'s nextCursor' })
  @IsOptional()
  @IsString()
  cursor?: string;
}
