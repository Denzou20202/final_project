import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@veloxdesk/common';
import type { JwtPayload } from '@veloxdesk/common';
import { UserRole } from '@veloxdesk/types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AddTagDto } from './dto/add-tag.dto.js';
import { UpdateTagDto } from './dto/update-tag.dto.js';
import { TagsService } from './tags.service.js';

// Unlike macros/custom-fields (admin-managed catalogs), tags auto-create on
// first use and any operator can attach/detach them — closer to a quick
// categorization tool than an admin-configured setting.
@ApiTags('tags')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OPERATOR, UserRole.ADMIN)
@Controller()
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get('tags')
  listAll() {
    return this.tagsService.listAll();
  }

  // Same admin-only tier as remove() below — renaming a tag changes it
  // everywhere it's already attached, not just for the caller.
  @Roles(UserRole.ADMIN)
  @Patch('tags/:id')
  rename(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTagDto) {
    return this.tagsService.rename(id, dto.name, dto.nameUk, dto.nameEn);
  }

  // Global delete (removes the tag from the catalog) — unlike everything
  // else in this controller, admin-only: a class-level @Roles(OPERATOR,
  // ADMIN) covers per-ticket attach/detach, but retiring a tag for
  // everyone is catalog management, same tier as Teams/SLA policies.
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('tags/:id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tagsService.remove(id);
  }

  @Get('tickets/:ticketId/tags')
  getForTicket(@Param('ticketId', ParseUUIDPipe) ticketId: string, @CurrentUser() actor: JwtPayload) {
    return this.tagsService.getForTicket(ticketId, actor);
  }

  @Post('tickets/:ticketId/tags')
  addToTicket(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: AddTagDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.tagsService.addToTicket(ticketId, dto.name, actor);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('tickets/:ticketId/tags/:tagId')
  removeFromTicket(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.tagsService.removeFromTicket(ticketId, tagId, actor);
  }
}
