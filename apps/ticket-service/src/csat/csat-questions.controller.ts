import { JwtAuthGuard, Roles, RolesGuard } from '@veloxdesk/common';
import { UserRole } from '@veloxdesk/types';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateCsatQuestionDto } from './dto/create-csat-question.dto.js';
import { UpdateCsatQuestionDto } from './dto/update-csat-question.dto.js';
import { CsatService } from './csat.service.js';

// Admin-only catalog management — the questions themselves (as opposed to
// /tickets/:id/csat below, which is the client-facing survey flow).
@ApiTags('csat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('csat/questions')
export class CsatQuestionsController {
  constructor(private readonly csatService: CsatService) {}

  @Get()
  list() {
    return this.csatService.listQuestions();
  }

  @Post()
  create(@Body() dto: CreateCsatQuestionDto) {
    return this.csatService.createQuestion(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCsatQuestionDto) {
    return this.csatService.updateQuestion(id, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.csatService.deleteQuestion(id);
  }
}
