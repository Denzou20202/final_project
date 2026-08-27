import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@veloxdesk/common';
import type { JwtPayload } from '@veloxdesk/common';
import { UserRole } from '@veloxdesk/types';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreatePermissionGroupDto } from './dto/create-permission-group.dto.js';
import { UpdatePermissionGroupDto } from './dto/update-permission-group.dto.js';
import { PermissionGroupsService } from './permission-groups.service.js';

// Mutations are admin-only — letting a non-admin edit its own restrictions
// would defeat the point. The list, however, follows teams.controller.ts:
// operators can read it too, because the (operator-visible) Users page
// renders each user's group NAME in its «Группа» column and would otherwise
// 403 on load.
@ApiTags('permission-groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('permission-groups')
export class PermissionGroupsController {
  constructor(private readonly permissionGroupsService: PermissionGroupsService) {}

  @Post()
  create(@Body() dto: CreatePermissionGroupDto, @CurrentUser() actor: JwtPayload) {
    return this.permissionGroupsService.create(dto, actor);
  }

  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @Get()
  list() {
    return this.permissionGroupsService.list();
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePermissionGroupDto, @CurrentUser() actor: JwtPayload) {
    return this.permissionGroupsService.update(id, dto, actor);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.permissionGroupsService.remove(id, actor);
  }
}
