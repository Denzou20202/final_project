import { TicketPriority } from '@veloxdesk/types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

// See list-tickets-query.dto.ts — same "UUID, 'unassigned', or 'assigned'" sentinels.
const ASSIGNED_TO_PATTERN = /^unassigned$|^assigned$|^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export class TicketCountsQueryDto {
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

  @ApiPropertyOptional({ enum: ['me'], description: 'Filter to tickets the current user is watching' })
  @IsOptional()
  @IsIn(['me'])
  watching?: 'me';

  @ApiPropertyOptional({ enum: ['me'], description: 'Filter to tickets the current user has been @mentioned on' })
  @IsOptional()
  @IsIn(['me'])
  mentioned?: 'me';

  @ApiPropertyOptional({ description: 'Quick search: ticket number (#42 or 42), client name, or subject words' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
