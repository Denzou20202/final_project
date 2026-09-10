import { JwtAuthGuard, Roles, RolesGuard } from '@veloxdesk/common';
import { UserRole } from '@veloxdesk/types';
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UpdateKnowledgeThemeDto } from './dto/update-knowledge-theme.dto.js';
import { KnowledgeThemeService } from './knowledge-theme.service.js';

// Admin-only both ways (unlike e.g. employee-statuses' settings, which
// operators can also read) — customCss/customJs run in every visitor's
// browser on the public FAQ, so even reading back the current script isn't
// handed to a non-admin operator.
@ApiTags('knowledge-theme')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('knowledge-theme')
export class KnowledgeThemeController {
  constructor(private readonly knowledgeThemeService: KnowledgeThemeService) {}

  @Get()
  get() {
    return this.knowledgeThemeService.get();
  }

  @Patch()
  update(@Body() dto: UpdateKnowledgeThemeDto) {
    return this.knowledgeThemeService.update(dto);
  }
}
