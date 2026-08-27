import { SEARCH_INDEX_QUEUE_NAME } from '@veloxdesk/types';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SearchIndexProducerService } from './search-index-producer.service.js';

// Producer side only (ticket-service) — the consumer (knowledge-service)
// registers its own worker against the same queue name.
@Module({
  imports: [BullModule.registerQueue({ name: SEARCH_INDEX_QUEUE_NAME })],
  providers: [SearchIndexProducerService],
  exports: [SearchIndexProducerService],
})
export class SearchIndexQueueModule {}
