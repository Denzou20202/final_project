import { JwtAuthGuard, Roles, RolesGuard } from '@veloxdesk/common';
import { UserRole } from '@veloxdesk/types';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateTicketCategoryDto } from './dto/create-ticket-category.dto.js';
import { UpdateTicketCategoryDto } from './dto/update-ticket-category.dto.js';
import { TicketCategoriesService } from './ticket-categories.service.js';

@ApiTags('ticket-categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ticket-categories')
export class TicketCategoriesController {
  constructor(private readonly categoriesService: TicketCategoriesService) {}

  // No @Roles — every authenticated role (client included) reads this list:
  // a client needs it to populate the «Категория» dropdown on NewTicketPage,
  // staff need it for the same dropdown in TicketAttributesPanel/
  // CreateTicketModal. Only mutating the catalog is admin-only, below.
  @Get()
  listAll() {
    return this.categoriesService.listAll();
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateTicketCategoryDto) {
    return this.categoriesService.create(dto.name, dto.nameUk, dto.nameEn);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  rename(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTicketCategoryDto) {
    return this.categoriesService.rename(id, dto.name, dto.nameUk, dto.nameEn);
  }

  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.remove(id);
  }
}
