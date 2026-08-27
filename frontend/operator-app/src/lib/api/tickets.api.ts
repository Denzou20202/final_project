import type { TicketPriority } from '@veloxdesk/types';
import { ticketApi } from './client.js';
import type {
  ListTicketsParams,
  PublicCsatSurvey,
  PublicTeamTicketCounts,
  PublicTicket,
  PublicTicketActivity,
  PublicTicketCounts,
  PublicTicketPage,
} from '../types.js';

export async function listTickets(params: ListTicketsParams): Promise<PublicTicketPage> {
  const { data } = await ticketApi.get<PublicTicketPage>('/tickets', { params });
  return data;
}

export async function fetchTicketCounts(
  params: Pick<ListTicketsParams, 'priority' | 'assignedTo' | 'teamId' | 'tagId' | 'watching' | 'mentioned' | 'search'>,
): Promise<PublicTicketCounts> {
  const { data } = await ticketApi.get<PublicTicketCounts>('/tickets/counts', { params });
  return data;
}

// One request for every team/tag's counts at once — backs the sidebar,
// which used to call fetchTicketCounts({ teamId }) / ({ tagId }) once per
// rendered team/tag.
export async function fetchTicketCountsByTeam(): Promise<Record<string, PublicTeamTicketCounts>> {
  const { data } = await ticketApi.get<Record<string, PublicTeamTicketCounts>>('/tickets/counts/by-team');
  return data;
}

export async function fetchTicketCountsByTag(): Promise<Record<string, PublicTicketCounts>> {
  const { data } = await ticketApi.get<Record<string, PublicTicketCounts>>('/tickets/counts/by-tag');
  return data;
}

export async function fetchTicket(id: string): Promise<PublicTicket> {
  const { data } = await ticketApi.get<PublicTicket>(`/tickets/${id}`);
  return data;
}

export async function fetchTicketByNumber(ticketNumber: number): Promise<PublicTicket> {
  const { data } = await ticketApi.get<PublicTicket>(`/tickets/by-number/${ticketNumber}`);
  return data;
}

export async function fetchTicketActivity(id: string): Promise<PublicTicketActivity[]> {
  const { data } = await ticketApi.get<PublicTicketActivity[]>(`/tickets/${id}/activity`);
  return data;
}

// Read-only here — operators/admins never POST to this endpoint, only the
// client (ticket owner) can submit answers.
export async function fetchCsatSurvey(id: string): Promise<PublicCsatSurvey> {
  const { data } = await ticketApi.get<PublicCsatSurvey>(`/tickets/${id}/csat`);
  return data;
}

export async function createTicket(input: {
  title: string;
  description: string;
  priority?: TicketPriority;
  onBehalfOf?: string;
  categoryId?: string;
}) {
  const { data } = await ticketApi.post<PublicTicket>('/tickets', input);
  return data;
}

export async function updateTicketStatus(id: string, statusId: string): Promise<PublicTicket> {
  const { data } = await ticketApi.patch<PublicTicket>(`/tickets/${id}/status`, { statusId });
  return data;
}

export async function updateTicketPriority(id: string, priority: TicketPriority): Promise<PublicTicket> {
  const { data } = await ticketApi.patch<PublicTicket>(`/tickets/${id}/priority`, { priority });
  return data;
}

export async function assignTicket(id: string, assigneeId: string): Promise<PublicTicket> {
  const { data } = await ticketApi.patch<PublicTicket>(`/tickets/${id}/assign`, { assigneeId });
  return data;
}

export async function assignTicketTeam(id: string, teamId: string): Promise<PublicTicket> {
  const { data } = await ticketApi.patch<PublicTicket>(`/tickets/${id}/team`, { teamId });
  return data;
}

export async function updateTicketType(id: string, typeId: string): Promise<PublicTicket> {
  const { data } = await ticketApi.patch<PublicTicket>(`/tickets/${id}`, { typeId });
  return data;
}

// null clears the ticket's category back to "none" — see AssignCategoryDto.
export async function updateTicketCategory(id: string, categoryId: string | null): Promise<PublicTicket> {
  const { data } = await ticketApi.patch<PublicTicket>(`/tickets/${id}/category`, { categoryId });
  return data;
}

export async function mergeTicket(id: string, targetTicketId: string): Promise<PublicTicket> {
  const { data } = await ticketApi.post<PublicTicket>(`/tickets/${id}/merge`, { targetTicketId });
  return data;
}

export async function deleteTicket(id: string): Promise<void> {
  await ticketApi.delete(`/tickets/${id}`);
}

export async function restoreTicket(id: string): Promise<PublicTicket> {
  const { data } = await ticketApi.post<PublicTicket>(`/tickets/${id}/restore`);
  return data;
}

// Permanent — only valid for a ticket already in Trash. Unlike deleteTicket
// (soft delete), there's nothing left to undo after this.
export async function hardDeleteTicket(id: string): Promise<void> {
  await ticketApi.delete(`/tickets/${id}/permanent`);
}

export async function fetchTrash(): Promise<PublicTicket[]> {
  const { data } = await ticketApi.get<PublicTicket[]>('/tickets/trash');
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

export async function sendStatusEmail(id: string): Promise<void> {
  await ticketApi.post(`/tickets/${id}/send-status`);
}

// Presigned-URL download doesn't apply here (this is generated on the fly,
// not a stored S3 object) — same authenticated-blob approach as the
// analytics CSV export, since a plain <a href> can't carry the auth header.
export async function exportTicket(id: string, ticketNumber: number): Promise<void> {
  const response = await ticketApi.get(`/tickets/${id}/export`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data as Blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ticket-${ticketNumber}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
