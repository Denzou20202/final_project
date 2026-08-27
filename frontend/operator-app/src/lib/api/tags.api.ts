import { ticketApi } from './client.js';
import type { PublicTag } from '../types.js';

export async function listAllTags(): Promise<PublicTag[]> {
  const { data } = await ticketApi.get<PublicTag[]>('/tags');
  return data;
}

export async function listTicketTags(ticketId: string): Promise<PublicTag[]> {
  const { data } = await ticketApi.get<PublicTag[]>(`/tickets/${ticketId}/tags`);
  return data;
}

export async function addTagToTicket(ticketId: string, name: string): Promise<PublicTag> {
  const { data } = await ticketApi.post<PublicTag>(`/tickets/${ticketId}/tags`, { name });
  return data;
}

export async function removeTagFromTicket(ticketId: string, tagId: string): Promise<void> {
  await ticketApi.delete(`/tickets/${ticketId}/tags/${tagId}`);
}

// Admin-only, global — renames the tag everywhere it's already attached
// (backend rejects with 400 if another tag already has that name).
export async function renameTag(id: string, name: string, nameUk?: string, nameEn?: string): Promise<PublicTag> {
  const { data } = await ticketApi.patch<PublicTag>(`/tags/${id}`, { name, nameUk, nameEn });
  return data;
}

// Admin-only, global — removes the tag from the catalog itself (backend
// rejects with 400 if any ticket still carries it).
export async function deleteTag(id: string): Promise<void> {
  await ticketApi.delete(`/tags/${id}`);
}
