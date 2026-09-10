import { TicketEntity } from '@veloxdesk/database';
import { SEARCH_INDEX_QUEUE_NAME } from '@veloxdesk/types';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module.js';
import { SearchIndexProcessor } from './search-index.processor.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: SEARCH_INDEX_QUEUE_NAME }),
    TypeOrmModule.forFeature([TicketEntity]),
    ElasticsearchModule,
  ],
  providers: [SearchIndexProcessor],
})
export class SearchIndexModule {}
