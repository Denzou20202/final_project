import { JwtAuthGuard, Roles, RolesGuard } from '@veloxdesk/common';
import { UserRole } from '@veloxdesk/types';
import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ContactsService } from './contacts.service.js';
import { MergeContactsDto } from './dto/merge-contacts.dto.js';

// Nested under /users so it rides the existing nginx `location /api/users`
// proxy block — no separate upstream/location needed (see
// project_veloxdesk_nginx_routing memory).
@ApiTags('contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users/contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  // Same read access as the Users list itself (GET /users) — operators can
  // already see every field this export contains.
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Get('export')
  async exportCsv(@Res() res: Response): Promise<void> {
    const csv = await this.contactsService.exportCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="veloxdesk-contacts-${Date.now()}.csv"`);
    res.send(csv);
  }

  // Admin-only — leads into merge, a hard-to-reverse action.
  @Roles(UserRole.ADMIN)
  @Get('duplicates')
  findDuplicateGroups() {
    return this.contactsService.findDuplicateGroups();
  }

  @Roles(UserRole.ADMIN)
  @Post('merge')
  merge(@Body() dto: MergeContactsDto) {
    return this.contactsService.merge(dto);
  }
}
