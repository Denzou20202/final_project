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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArticlesService } from './articles.service.js';
import { CreateArticleDto } from './dto/create-article.dto.js';
import { ListArticlesQueryDto } from './dto/list-articles-query.dto.js';
import { UpdateArticleDto } from './dto/update-article.dto.js';

// Any operator/admin can create, edit, and publish any article — there's no
// per-author edit restriction, matching how the rest of the team manages
// shared tickets.
@ApiTags('articles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OPERATOR, UserRole.ADMIN)
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  create(@Body() dto: CreateArticleDto, @CurrentUser() actor: JwtPayload) {
    return this.articlesService.create(dto, actor);
  }

  @Get()
  list(@Query() query: ListArticlesQueryDto) {
    return this.articlesService.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.articlesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateArticleDto) {
    return this.articlesService.update(id, dto);
  }

  @Patch(':id/publish')
  publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.articlesService.publish(id);
  }

  @Patch(':id/unpublish')
  unpublish(@Param('id', ParseUUIDPipe) id: string) {
    return this.articlesService.unpublish(id);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.articlesService.remove(id);
  }
}
