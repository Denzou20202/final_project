import { JwtAuthGuard, Roles, RolesGuard } from '@veloxdesk/common';
import { UserRole } from '@veloxdesk/types';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateCityDto } from './dto/create-city.dto.js';
import { UpdateCityDto } from './dto/update-city.dto.js';
import { CitiesService } from './cities.service.js';

@ApiTags('cities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cities')
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  // No @Roles — see CompaniesController's own comment, same reasoning.
  @Get()
  listAll() {
    return this.citiesService.listAll();
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateCityDto) {
    return this.citiesService.create(dto.name);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  rename(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCityDto) {
    return this.citiesService.rename(id, dto.name);
  }

  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.citiesService.remove(id);
  }
}
