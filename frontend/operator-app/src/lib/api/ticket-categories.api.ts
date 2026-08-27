import { ticketApi } from './client.js';
import type { PublicTicketCategory } from '../types.js';

export async function listTicketCategories(): Promise<PublicTicketCategory[]> {
  const { data } = await ticketApi.get<PublicTicketCategory[]>('/ticket-categories');
  return data;
}

export async function createTicketCategory(name: string, nameUk?: string, nameEn?: string): Promise<PublicTicketCategory> {
  const { data } = await ticketApi.post<PublicTicketCategory>('/ticket-categories', { name, nameUk, nameEn });
  return data;
}

export async function renameTicketCategory(
  id: string,
  name: string,
  nameUk?: string,
  nameEn?: string,
): Promise<PublicTicketCategory> {
  const { data } = await ticketApi.patch<PublicTicketCategory>(`/ticket-categories/${id}`, { name, nameUk, nameEn });
  return data;
}

export async function deleteTicketCategory(id: string): Promise<void> {
  await ticketApi.delete(`/ticket-categories/${id}`);
}
