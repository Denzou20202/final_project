import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@veloxdesk/common';
import type { JwtPayload } from '@veloxdesk/common';
import { UserRole } from '@veloxdesk/types';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SearchQueryDto } from './dto/search-query.dto.js';
import { SearchService } from './search.service.js';

// Ticket search is operator/admin only — it can surface ticket titles and
// descriptions across the whole system, which clients must not see. Staff
// results are additionally scoped by the actor's permission-group
// restrictions (see SearchService.filterHitsForActor).
@ApiTags('search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OPERATOR, UserRole.ADMIN)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('tickets')
  searchTickets(@Query() query: SearchQueryDto, @CurrentUser() actor: JwtPayload) {
    return this.searchService.searchTickets(actor, query.q, query.limit);
  }
}
