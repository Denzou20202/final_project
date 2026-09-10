import { ticketApi } from './client.js';
import type { PublicMacro } from '../types.js';

export async function listMacros(): Promise<PublicMacro[]> {
  const { data } = await ticketApi.get<PublicMacro[]>('/macros');
  return data;
}

export async function createMacro(
  input: { title: string; titleUk?: string; titleEn?: string; body: string },
): Promise<PublicMacro> {
  const { data } = await ticketApi.post<PublicMacro>('/macros', input);
  return data;
}

export async function updateMacro(
  id: string,
  input: Partial<{ title: string; titleUk: string; titleEn: string; body: string }>,
): Promise<PublicMacro> {
  const { data } = await ticketApi.patch<PublicMacro>(`/macros/${id}`, input);
  return data;
}

export async function deleteMacro(id: string): Promise<void> {
  await ticketApi.delete(`/macros/${id}`);
}
