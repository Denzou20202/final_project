import { ticketApi } from './client.js';
import type { PublicTicketStatus } from '../types.js';

export interface TicketStatusInput {
  name: string;
  nameUk?: string;
  nameEn?: string;
  color: string;
  isDefault?: boolean;
  isClosed?: boolean;
  tracksSla?: boolean;
}

export async function listTicketStatuses(): Promise<PublicTicketStatus[]> {
  const { data } = await ticketApi.get<PublicTicketStatus[]>('/ticket-statuses');
  return data;
}

export async function createTicketStatus(input: TicketStatusInput): Promise<PublicTicketStatus> {
  const { data } = await ticketApi.post<PublicTicketStatus>('/ticket-statuses', input);
  return data;
}

export async function updateTicketStatus(id: string, input: Partial<TicketStatusInput>): Promise<PublicTicketStatus> {
  const { data } = await ticketApi.patch<PublicTicketStatus>(`/ticket-statuses/${id}`, input);
  return data;
}

export async function deleteTicketStatus(id: string): Promise<void> {
  await ticketApi.delete(`/ticket-statuses/${id}`);
}

export async function moveTicketStatusUp(id: string): Promise<void> {
  await ticketApi.patch(`/ticket-statuses/${id}/move-up`);
}

export async function moveTicketStatusDown(id: string): Promise<void> {
  await ticketApi.patch(`/ticket-statuses/${id}/move-down`);
}
