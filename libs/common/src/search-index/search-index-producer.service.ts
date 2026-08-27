import { SEARCH_INDEX_QUEUE_NAME, SearchIndexJobPayload } from '@veloxdesk/types';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class SearchIndexProducerService {
  constructor(@InjectQueue(SEARCH_INDEX_QUEUE_NAME) private readonly queue: Queue<SearchIndexJobPayload>) {}

  enqueueTicket(ticketId: string): Promise<unknown> {
    return this.queue.add(
      'index-ticket',
      { ticketId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }
}
