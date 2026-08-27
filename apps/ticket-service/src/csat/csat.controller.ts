import { CurrentUser, JwtAuthGuard, RolesGuard } from '@veloxdesk/common';
import type { JwtPayload } from '@veloxdesk/common';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SubmitCsatDto } from './dto/submit-csat.dto.js';
import { CsatService } from './csat.service.js';

// No @Roles() at class or method level — every role (client/operator/admin)
// can reach GET (the client to answer, staff to view read-only in the
// ticket panel); CsatService itself enforces who's actually allowed to see
// THIS ticket's survey, same ownership rule as everywhere else. POST
// additionally checks inside the service that the actor is the client who
// owns the ticket — a class-level @Roles(CLIENT) would have blocked staff
// from the GET too.
@ApiTags('csat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tickets/:ticketId/csat')
export class CsatController {
  constructor(private readonly csatService: CsatService) {}

  @Get()
  getSurvey(@Param('ticketId', ParseUUIDPipe) ticketId: string, @CurrentUser() actor: JwtPayload) {
    return this.csatService.getSurvey(ticketId, actor);
  }

  @Post()
  submit(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: SubmitCsatDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.csatService.submitAnswers(ticketId, actor, dto.answers);
  }
}
