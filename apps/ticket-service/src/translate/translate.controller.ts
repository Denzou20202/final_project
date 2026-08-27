import { JwtAuthGuard, Roles, RolesGuard } from '@veloxdesk/common';
import { UserRole } from '@veloxdesk/types';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TranslateDto } from './dto/translate.dto.js';
import { TranslateService } from './translate.service.js';

// Generic RU→UK/EN utility backing the auto-translate form-fill on all 8
// admin catalogs (ticket statuses, custom fields, macros, articles, teams,
// tags, categories, employee statuses) — hosted once here rather than
// duplicated into user-service/knowledge-service, since it has no
// dependency on which entity the caller is actually editing. OPERATOR is
// included (not ADMIN-only) because macros and knowledge articles are
// operator-editable too — this call has no side effects on any entity, so
// there's no reason to gate it tighter than the loosest of the 8 forms
// that need it.
@ApiTags('translate')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OPERATOR, UserRole.ADMIN)
@Controller('translate')
export class TranslateController {
  constructor(private readonly translateService: TranslateService) {}

  @Post()
  translate(@Body() dto: TranslateDto) {
    return this.translateService.translate(dto.text);
  }
}
