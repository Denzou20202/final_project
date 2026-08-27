import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { KnowledgeThemeService } from './knowledge-theme.service.js';

// No auth — client-portal's /faq pages fetch this to inject the admin's
// custom CSS/JS before a visitor even has an account, same reasoning as
// public-articles.controller.ts.
@ApiTags('public-knowledge-theme')
@Controller('public/knowledge-theme')
export class PublicKnowledgeThemeController {
  constructor(private readonly knowledgeThemeService: KnowledgeThemeService) {}

  @Get()
  get() {
    return this.knowledgeThemeService.get();
  }
}
