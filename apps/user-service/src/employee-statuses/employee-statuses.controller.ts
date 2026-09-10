import { JwtAuthGuard, Roles, RolesGuard } from '@veloxdesk/common';
import { UserRole } from '@veloxdesk/types';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateEmployeeStatusDto } from './dto/create-employee-status.dto.js';
import { UpdateEmployeeStatusDto } from './dto/update-employee-status.dto.js';
import { UpdatePresenceSettingsDto } from './dto/update-presence-settings.dto.js';
import { EmployeeStatusesService } from './employee-statuses.service.js';

// Mutations are admin-only, same split as permission-groups.controller.ts —
// the list and the inactivity-timeout setting are operator-readable because
// the status picker (Sidebar) and the client-side idle timer need them, and
// every staff member uses both.
@ApiTags('employee-statuses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('employee-statuses')
export class EmployeeStatusesController {
  constructor(private readonly employeeStatusesService: EmployeeStatusesService) {}

  @Post()
  create(@Body() dto: CreateEmployeeStatusDto) {
    return this.employeeStatusesService.create(dto);
  }

  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @Get()
  list() {
    return this.employeeStatusesService.list();
  }

  // Literal routes declared before ':id' below — otherwise Nest would try
  // to match "settings" as a :id and 404/400 on the UUID pipe.
  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @Get('settings')
  getSettings() {
    return this.employeeStatusesService.getSettings();
  }

  @Patch('settings')
  updateSettings(@Body() dto: UpdatePresenceSettingsDto) {
    return this.employeeStatusesService.updateSettings(dto.inactivityTimeoutMinutes);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEmployeeStatusDto) {
    return this.employeeStatusesService.update(id, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeStatusesService.remove(id);
  }
}
