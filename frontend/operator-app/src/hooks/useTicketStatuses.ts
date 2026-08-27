import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTicketStatus,
  deleteTicketStatus,
  listTicketStatuses,
  moveTicketStatusDown,
  moveTicketStatusUp,
  TicketStatusInput,
  updateTicketStatus,
} from '../lib/api/ticket-statuses.api.js';

// Read constantly (ticket detail, sidebar, report builder, automation
// builder all depend on this) — a 60s staleTime matches useEmployeeStatuses/
// useTicketCategories, the closest analogous catalogs.
export function useTicketStatuses() {
  return useQuery({
    queryKey: ['ticket-statuses'],
    queryFn: listTicketStatuses,
    staleTime: 60_000,
  });
}

export function useCreateTicketStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TicketStatusInput) => createTicketStatus(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket-statuses'] }),
  });
}

export function useUpdateTicketStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<TicketStatusInput>) => updateTicketStatus(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket-statuses'] }),
  });
}

export function useDeleteTicketStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTicketStatus,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket-statuses'] }),
  });
}

export function useMoveTicketStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) =>
      direction === 'up' ? moveTicketStatusUp(id) : moveTicketStatusDown(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket-statuses'] }),
  });
}
