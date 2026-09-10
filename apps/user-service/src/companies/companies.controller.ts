import { JwtAuthGuard, Roles, RolesGuard } from '@veloxdesk/common';
import { UserRole } from '@veloxdesk/types';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';
import { CompaniesService } from './companies.service.js';

@ApiTags('companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  // No @Roles — every authenticated role (client included) reads this
  // list: a client needs it for the onboarding form's «Компания» dropdown,
  // staff need it for the same dropdown in EditUserModal. Only mutating
  // the catalog is admin-only, below.
  @Get()
  listAll() {
    return this.companiesService.listAll();
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto.name);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  rename(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.rename(id, dto.name);
  }

  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.companiesService.remove(id);
  }
}
