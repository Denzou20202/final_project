import { ticketApi } from './client.js';
import type { PublicTicketCategory } from '../types.js';

// Read-only here — category management is an operator-app admin-settings
// feature (TicketCategoriesModule); a client only ever picks from the list.
export async function listTicketCategories(): Promise<PublicTicketCategory[]> {
  const { data } = await ticketApi.get<PublicTicketCategory[]>('/ticket-categories');
  return data;
}
