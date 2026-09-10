import { TicketEntity } from '@veloxdesk/database';
import { SEARCH_INDEX_QUEUE_NAME, SearchIndexJobPayload } from '@veloxdesk/types';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { ElasticsearchService, TICKETS_INDEX } from '../elasticsearch/elasticsearch.service.js';

@Processor(SEARCH_INDEX_QUEUE_NAME)
export class SearchIndexProcessor extends WorkerHost {
  private readonly logger = new Logger(SearchIndexProcessor.name);

  constructor(
    @InjectRepository(TicketEntity)
    private readonly ticketsRepository: Repository<TicketEntity>,
    private readonly elasticsearch: ElasticsearchService,
  ) {
    super();
  }

  async process(job: Job<SearchIndexJobPayload>): Promise<void> {
    const { ticketId } = job.data;

    // Re-reads current state from Postgres rather than trusting whatever
    // snapshot the job was enqueued with — if several updates to the same
    // ticket enqueue jobs that run out of order, each still converges on
    // the same up-to-date document instead of a stale one winning.
    //
    // findOne excludes soft-deleted rows by default, so this branch covers
    // BOTH a ticket sitting in Trash and one that's been permanently
    // hard-deleted — either way it shouldn't be searchable/clickable
    // anymore, so the document is removed from the index rather than just
    // skipped (skipping used to leave trashed tickets searchable forever,
    // and would leave a hard-deleted ticket's doc pointing at a 404).
    const ticket = await this.ticketsRepository.findOne({ where: { id: ticketId }, relations: ['status'] });
    if (!ticket) {
      await this.elasticsearch.delete(TICKETS_INDEX, ticketId);
      this.logger.log(`Removed ticket ${ticketId} from the index (trashed or deleted)`);
      return;
    }

    // A merged-away ticket isn't soft-deleted (TicketsService.merge() closes
    // it and sets mergedIntoId, but leaves deleted_at null), so the !ticket
    // branch above never catches it — yet merge() enqueues this same
    // re-index job for the source ticket on every merge. Without this check
    // that job would re-index the merge-source and leave it fully
    // searchable/clickable forever, duplicating its now-canonical target.
    if (ticket.mergedIntoId) {
      await this.elasticsearch.delete(TICKETS_INDEX, ticketId);
      this.logger.log(`Removed ticket ${ticketId} from the index (merged into ${ticket.mergedIntoId})`);
      return;
    }

    await this.elasticsearch.index(TICKETS_INDEX, ticket.id, {
      title: ticket.title,
      description: ticket.description,
      // Just the id (still a valid ES `keyword`, no mapping change needed) —
      // not the full status object, since ticket_statuses is now an
      // admin-editable catalog and re-fetching it fresh on read (via the
      // frontend's already-cached useTicketStatuses()) beats denormalizing a
      // name/color into every indexed document that would go stale the
      // moment an admin renames/recolors a status.
      status: ticket.status.id,
      priority: ticket.priority,
      createdBy: ticket.createdBy,
      assignedTo: ticket.assignedTo ?? null,
      createdAt: ticket.createdAt,
    });

    this.logger.log(`Indexed ticket ${ticketId}`);
  }
}
