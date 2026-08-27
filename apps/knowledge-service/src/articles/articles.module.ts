import { KnowledgeArticleEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module.js';
import { ArticlesController } from './articles.controller.js';
import { ArticlesRepository } from './articles.repository.js';
import { ArticlesService } from './articles.service.js';
import { PublicArticlesController } from './public-articles.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([KnowledgeArticleEntity]), ElasticsearchModule],
  controllers: [ArticlesController, PublicArticlesController],
  providers: [ArticlesService, ArticlesRepository],
})
export class ArticlesModule {}
