import { MetricsModule } from '@veloxdesk/common';
import { entities } from '@veloxdesk/database';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticleImagesModule } from '../article-images/article-images.module.js';
import { ArticlesModule } from '../articles/articles.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module.js';
import { KnowledgeThemeModule } from '../knowledge-theme/knowledge-theme.module.js';
import { SearchModule } from '../search/search.module.js';
import { SearchIndexModule } from '../search-index/search-index.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USER', 'veloxdesk'),
        password: config.get<string>('DB_PASSWORD', 'secret'),
        database: config.get<string>('DB_NAME', 'veloxdesk'),
        entities,
        synchronize: false,
        extra: {
          max: config.get<number>('DB_POOL_MAX', 10),
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 2_000,
        },
      }),
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
    }),
    ElasticsearchModule,
    AuthModule,
    ArticlesModule,
    ArticleImagesModule,
    KnowledgeThemeModule,
    SearchModule,
    SearchIndexModule,
    MetricsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
