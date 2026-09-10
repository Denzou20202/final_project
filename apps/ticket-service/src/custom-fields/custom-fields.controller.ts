import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@veloxdesk/common';
import type { JwtPayload } from '@veloxdesk/common';
import { UserRole } from '@veloxdesk/types';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateCustomFieldDefinitionDto } from './dto/create-custom-field-definition.dto.js';
import { UpdateCustomFieldDefinitionDto } from './dto/update-custom-field-definition.dto.js';
import { CustomFieldsService } from './custom-fields.service.js';

// Read access for operators is load-bearing, not just a nicety: the
// per-ticket custom-field VALUES UI (TicketAttributesPanel/
// CustomFieldsSection, via ticket-custom-field-values.controller.ts) reads
// this GET to know what fields/types exist before it can render a single
// input — restricting it to admin-only would silently break every
// operator's ability to fill in custom fields on a ticket. Only the
// definitions MANAGEMENT page (create/update/delete below, and the
// "Кастомные поля" nav item — not in the operator role's permission set)
// is admin-only.
@ApiTags('custom-fields')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OPERATOR, UserRole.ADMIN)
@Controller('custom-fields')
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateCustomFieldDefinitionDto, @CurrentUser() actor: JwtPayload) {
    return this.customFieldsService.createDefinition(dto, actor);
  }

  @Get()
  list() {
    return this.customFieldsService.listDefinitions();
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomFieldDefinitionDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.customFieldsService.updateDefinition(id, dto, actor);
  }

  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.customFieldsService.removeDefinition(id, actor);
  }
}
