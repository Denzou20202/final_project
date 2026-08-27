// Shared BullMQ contract between the producer (ticket-service) and the
// consumer (knowledge-service) for reliable Elasticsearch indexing. Unlike
// the ticket-events Redis pub/sub channel, a dropped job here would
// permanently drop a ticket from search — so this goes through the same
// persisted/retried queue mechanism as the notifications queue.
export const SEARCH_INDEX_QUEUE_NAME = 'search-index';

export interface SearchIndexJobPayload {
  ticketId: string;
}
