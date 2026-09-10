import { JwtAuthGuard, Roles, RolesGuard } from '@veloxdesk/common';
import { UserRole } from '@veloxdesk/types';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateMacroDto } from './dto/create-macro.dto.js';
import { UpdateMacroDto } from './dto/update-macro.dto.js';
import { MacrosService } from './macros.service.js';

// Unlike SLA policies/custom fields/automation rules, macros are a day-to-
// day authoring tool for whoever's answering tickets — operators get full
// create/edit/delete here, not just read access.
@ApiTags('macros')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('macros')
export class MacrosController {
  constructor(private readonly macrosService: MacrosService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateMacroDto) {
    return this.macrosService.create(dto);
  }

  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @Get()
  list() {
    return this.macrosService.list();
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMacroDto) {
    return this.macrosService.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.macrosService.remove(id);
  }
}
