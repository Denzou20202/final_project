import { KnowledgeArticleEntity } from '@veloxdesk/database';
import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Redis } from 'ioredis';
import { ArticleImagesModule } from '../article-images/article-images.module.js';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module.js';
import { ArticlesController } from './articles.controller.js';
import { ArticlesRepository } from './articles.repository.js';
import { ArticlesService } from './articles.service.js';
import { PublicArticlesController } from './public-articles.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([KnowledgeArticleEntity]), ElasticsearchModule, ArticleImagesModule],
  controllers: [ArticlesController, PublicArticlesController],
  providers: [
    ArticlesService,
    ArticlesRepository,
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const client = new Redis({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          lazyConnect: true,
        });
        const logger = new Logger('KnowledgeRedis');
        client.on('error', (error) => logger.error(`Redis connection error: ${error.message}`));
        return client;
      },
    },
  ],
})
export class ArticlesModule {}
