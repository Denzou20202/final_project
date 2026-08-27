import type { TicketPriority } from '@veloxdesk/types';
import { ticketApi } from './client.js';
import type { PublicSlaPolicy } from '../types.js';

export async function listSlaPolicies(): Promise<PublicSlaPolicy[]> {
  const { data } = await ticketApi.get<PublicSlaPolicy[]>('/sla-policies');
  return data;
}

export async function createSlaPolicy(input: {
  name: string;
  responseTimeMin: number;
  resolutionTimeMin: number;
  priority: TicketPriority;
}): Promise<PublicSlaPolicy> {
  const { data } = await ticketApi.post<PublicSlaPolicy>('/sla-policies', input);
  return data;
}

export async function updateSlaPolicy(
  id: string,
  input: Partial<{ name: string; responseTimeMin: number; resolutionTimeMin: number; priority: TicketPriority }>,
): Promise<PublicSlaPolicy> {
  const { data } = await ticketApi.patch<PublicSlaPolicy>(`/sla-policies/${id}`, input);
  return data;
}

export async function deleteSlaPolicy(id: string): Promise<void> {
  await ticketApi.delete(`/sla-policies/${id}`);
}
