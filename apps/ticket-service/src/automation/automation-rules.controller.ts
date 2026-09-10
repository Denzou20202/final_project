import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@veloxdesk/common';
import type { JwtPayload } from '@veloxdesk/common';
import { UserRole } from '@veloxdesk/types';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto.js';
import { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto.js';
import { AutomationRulesService } from './automation-rules.service.js';

// Admin-only end to end, unlike macros/SLA policies/custom fields — the
// "Диспетчер" isn't in the operator role's permission set at all (no
// read-only allowance), and nothing outside this page's own list view
// depends on GET here (unlike custom-fields' GET, which the per-ticket
// values UI also needs — see custom-fields.controller.ts).
@ApiTags('automation-rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('automation-rules')
export class AutomationRulesController {
  constructor(private readonly automationRulesService: AutomationRulesService) {}

  @Post()
  create(@Body() dto: CreateAutomationRuleDto, @CurrentUser() actor: JwtPayload) {
    return this.automationRulesService.create(dto, actor);
  }

  @Get()
  list() {
    return this.automationRulesService.list();
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAutomationRuleDto, @CurrentUser() actor: JwtPayload) {
    return this.automationRulesService.update(id, dto, actor);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.automationRulesService.remove(id, actor);
  }
}
