import { TicketEntity, TicketMentionEntity } from '@veloxdesk/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [ElasticsearchModule, TypeOrmModule.forFeature([TicketEntity, TicketMentionEntity])],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
