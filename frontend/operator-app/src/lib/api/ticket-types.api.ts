import { ticketApi } from './client.js';
import type { PublicTicketType } from '../types.js';

export interface TicketTypeInput {
  name: string;
  nameUk?: string;
  nameEn?: string;
  color: string;
  isDefault?: boolean;
  weight?: number;
}

export async function listTicketTypes(): Promise<PublicTicketType[]> {
  const { data } = await ticketApi.get<PublicTicketType[]>('/ticket-types');
  return data;
}

export async function createTicketType(input: TicketTypeInput): Promise<PublicTicketType> {
  const { data } = await ticketApi.post<PublicTicketType>('/ticket-types', input);
  return data;
}

export async function updateTicketType(id: string, input: Partial<TicketTypeInput>): Promise<PublicTicketType> {
  const { data } = await ticketApi.patch<PublicTicketType>(`/ticket-types/${id}`, input);
  return data;
}

export async function deleteTicketType(id: string): Promise<void> {
  await ticketApi.delete(`/ticket-types/${id}`);
}

export async function moveTicketTypeUp(id: string): Promise<void> {
  await ticketApi.patch(`/ticket-types/${id}/move-up`);
}

export async function moveTicketTypeDown(id: string): Promise<void> {
  await ticketApi.patch(`/ticket-types/${id}/move-down`);
}
