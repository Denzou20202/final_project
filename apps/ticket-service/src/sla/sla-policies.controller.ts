import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@veloxdesk/common';
import type { JwtPayload } from '@veloxdesk/common';
import { UserRole } from '@veloxdesk/types';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateSlaPolicyDto } from './dto/create-sla-policy.dto.js';
import { UpdateSlaPolicyDto } from './dto/update-sla-policy.dto.js';
import { SlaPoliciesService } from './sla-policies.service.js';

// Read access for operators (they benefit from knowing what the SLA is),
// mutations restricted to admins — SLA policy changes affect the whole team.
@ApiTags('sla-policies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OPERATOR, UserRole.ADMIN)
@Controller('sla-policies')
export class SlaPoliciesController {
  constructor(private readonly slaPoliciesService: SlaPoliciesService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateSlaPolicyDto, @CurrentUser() actor: JwtPayload) {
    return this.slaPoliciesService.create(dto, actor);
  }

  @Get()
  list() {
    return this.slaPoliciesService.list();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.slaPoliciesService.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSlaPolicyDto, @CurrentUser() actor: JwtPayload) {
    return this.slaPoliciesService.update(id, dto, actor);
  }

  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.slaPoliciesService.remove(id, actor);
  }
}
