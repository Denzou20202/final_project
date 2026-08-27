import { KnowledgeThemeEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KnowledgeThemeController } from './knowledge-theme.controller.js';
import { KnowledgeThemeRepository } from './knowledge-theme.repository.js';
import { KnowledgeThemeService } from './knowledge-theme.service.js';
import { PublicKnowledgeThemeController } from './public-knowledge-theme.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([KnowledgeThemeEntity])],
  controllers: [KnowledgeThemeController, PublicKnowledgeThemeController],
  providers: [KnowledgeThemeService, KnowledgeThemeRepository],
})
export class KnowledgeThemeModule {}
