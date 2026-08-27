import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@veloxdesk/common';
import type { JwtPayload } from '@veloxdesk/common';
import { UserRole } from '@veloxdesk/types';
import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SetCustomFieldValueDto } from './dto/set-custom-field-value.dto.js';
import { CustomFieldsService } from './custom-fields.service.js';

// Nested under /tickets/:ticketId — a separate controller (rather than
// adding these routes to TicketsController) since custom-field values are
// owned by this module, not by TicketsService.
@ApiTags('custom-fields')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OPERATOR, UserRole.ADMIN)
@Controller('tickets/:ticketId/custom-field-values')
export class TicketCustomFieldValuesController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @Get()
  list(@Param('ticketId', ParseUUIDPipe) ticketId: string, @CurrentUser() actor: JwtPayload) {
    return this.customFieldsService.getValuesForTicket(ticketId, actor);
  }

  @Put(':fieldId')
  set(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
    @Body() dto: SetCustomFieldValueDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.customFieldsService.setValue(ticketId, fieldId, dto.value, actor);
  }
}
