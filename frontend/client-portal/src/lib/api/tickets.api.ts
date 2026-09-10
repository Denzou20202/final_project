import type { TicketPriority } from '@veloxdesk/types';
import { ticketApi } from './client.js';
import type {
  ListTicketsParams,
  PublicCsatSurvey,
  PublicTicket,
  PublicTicketActivity,
  PublicTicketCounts,
  PublicTicketPage,
} from '../types.js';

// The server scopes these to the caller's own tickets for the client role —
// there's no separate "my tickets" endpoint, and no status/priority/assign
// mutations here since those are operator/admin-only server-side.
export async function listTickets(params: ListTicketsParams): Promise<PublicTicketPage> {
  const { data } = await ticketApi.get<PublicTicketPage>('/tickets', { params });
  return data;
}

export async function fetchTicketCounts(
  params: Pick<ListTicketsParams, 'watching' | 'search' | 'assignedTo'> = {},
): Promise<PublicTicketCounts> {
  const { data } = await ticketApi.get<PublicTicketCounts>('/tickets/counts', { params });
  return data;
}

export async function fetchTicket(id: string): Promise<PublicTicket> {
  const { data } = await ticketApi.get<PublicTicket>(`/tickets/${id}`);
  return data;
}

export async function fetchTicketActivity(id: string): Promise<PublicTicketActivity[]> {
  const { data } = await ticketApi.get<PublicTicketActivity[]>(`/tickets/${id}/activity`);
  return data;
}

export async function createTicket(input: {
  title: string;
  description: string;
  priority?: TicketPriority;
  categoryId?: string;
}) {
  // descriptionCommentId lets the caller link an immediately-following
  // attachment upload to the opening message (see NewTicketPage.tsx)
  // instead of it ending up ticket-scoped and racing the auto-reply for a
  // timeline slot.
  const { data } = await ticketApi.post<PublicTicket & { descriptionCommentId: string }>('/tickets', input);
  return data;
}

export async function fetchWatchStatus(id: string): Promise<{ isWatching: boolean }> {
  const { data } = await ticketApi.get<{ isWatching: boolean }>(`/tickets/${id}/watch`);
  return data;
}

export async function watchTicket(id: string): Promise<void> {
  await ticketApi.post(`/tickets/${id}/watch`);
}

export async function unwatchTicket(id: string): Promise<void> {
  await ticketApi.delete(`/tickets/${id}/watch`);
}

export async function fetchCsatSurvey(ticketId: string): Promise<PublicCsatSurvey> {
  const { data } = await ticketApi.get<PublicCsatSurvey>(`/tickets/${ticketId}/csat`);
  return data;
}

export async function submitCsatSurvey(
  ticketId: string,
  answers: { questionId: string; score: number }[],
): Promise<PublicCsatSurvey> {
  const { data } = await ticketApi.post<PublicCsatSurvey>(`/tickets/${ticketId}/csat`, { answers });
  return data;
}
