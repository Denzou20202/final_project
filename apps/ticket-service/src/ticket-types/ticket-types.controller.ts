import { JwtAuthGuard, Roles, RolesGuard } from '@veloxdesk/common';
import { UserRole } from '@veloxdesk/types';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto.js';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto.js';
import { TicketTypesService } from './ticket-types.service.js';

@ApiTags('ticket-types')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ticket-types')
export class TicketTypesController {
  constructor(private readonly typesService: TicketTypesService) {}

  // No @Roles — every authenticated role reads this: staff need it for the
  // ticket type dropdown, the report builder filter, and the "type" column
  // on ticket creation. Only mutating the catalog is admin-only, below.
  @Get()
  listAll() {
    return this.typesService.listAll();
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateTicketTypeDto) {
    return this.typesService.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTicketTypeDto) {
    return this.typesService.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/move-up')
  moveUp(@Param('id', ParseUUIDPipe) id: string) {
    return this.typesService.moveUp(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/move-down')
  moveDown(@Param('id', ParseUUIDPipe) id: string) {
    return this.typesService.moveDown(id);
  }

  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.typesService.remove(id);
  }
}
