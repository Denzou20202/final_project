import { ticketApi } from './client.js';
import type { PublicTicketStatus } from '../types.js';

// Read-only here — status management is an operator-app admin-settings
// feature (TicketStatusesModule); a client only ever sees the catalog to
// render StatusBadge/Sidebar folders.
export async function listTicketStatuses(): Promise<PublicTicketStatus[]> {
  const { data } = await ticketApi.get<PublicTicketStatus[]>('/ticket-statuses');
  return data;
}
