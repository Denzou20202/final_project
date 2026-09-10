import { JwtAuthGuard, Roles, RolesGuard } from '@veloxdesk/common';
import { UserRole } from '@veloxdesk/types';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateTicketStatusDto } from './dto/create-ticket-status.dto.js';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto.js';
import { TicketStatusesService } from './ticket-statuses.service.js';

@ApiTags('ticket-statuses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ticket-statuses')
export class TicketStatusesController {
  constructor(private readonly statusesService: TicketStatusesService) {}

  // No @Roles — every authenticated role (client included) reads this:
  // client-portal needs it for StatusBadge/Sidebar folders, staff need it
  // for the same plus the ticket status dropdown, automation builder, and
  // report builder filter. Only mutating the catalog is admin-only, below.
  @Get()
  listAll() {
    return this.statusesService.listAll();
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateTicketStatusDto) {
    return this.statusesService.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTicketStatusDto) {
    return this.statusesService.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/move-up')
  moveUp(@Param('id', ParseUUIDPipe) id: string) {
    return this.statusesService.moveUp(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/move-down')
  moveDown(@Param('id', ParseUUIDPipe) id: string) {
    return this.statusesService.moveDown(id);
  }

  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.statusesService.remove(id);
  }
}
