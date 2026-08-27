import { knowledgeApi } from './client.js';
import type { TicketSearchResult } from '../types.js';

export async function searchTickets(q: string): Promise<TicketSearchResult[]> {
  const { data } = await knowledgeApi.get<TicketSearchResult[]>('/search/tickets', { params: { q } });
  return data;
}
