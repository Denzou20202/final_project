import { CurrentUser, OptionalJwtAuthGuard } from '@veloxdesk/common';
import type { JwtPayload } from '@veloxdesk/common';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ArticlesService } from './articles.service.js';
import { ListArticlesQueryDto } from './dto/list-articles-query.dto.js';
import { RateArticleDto } from './dto/rate-article.dto.js';
import { SearchQueryDto } from '../search/dto/search-query.dto.js';

// Optionally authenticated — this is the client-facing FAQ surface,
// reachable before a user has an account. A logged-out visitor (or an
// expired/invalid token) only ever sees `isPublic` published articles; a
// resolved actor (any authenticated client/operator/admin token) also sees
// private-but-published ones. Never rejects the request over a bad token —
// see OptionalJwtAuthGuard.
@ApiTags('public-articles')
@UseGuards(OptionalJwtAuthGuard)
@Controller('public/articles')
export class PublicArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  list(@Query() query: ListArticlesQueryDto, @CurrentUser() actor?: JwtPayload) {
    return this.articlesService.listPublished(query, !!actor);
  }

  // Must come before the `:id` route below — otherwise "search" would be
  // parsed as an article id by ParseUUIDPipe and 400 instead of matching here.
  @Get('search')
  search(@Query() query: SearchQueryDto, @CurrentUser() actor?: JwtPayload) {
    return this.articlesService.searchPublished(query.q, query.limit, !!actor);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor?: JwtPayload) {
    return this.articlesService.findPublishedOrThrow(id, !!actor);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':id/rate')
  rate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RateArticleDto, @CurrentUser() actor?: JwtPayload) {
    return this.articlesService.rate(id, dto, !!actor);
  }
}
