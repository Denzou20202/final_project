import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTicketType,
  deleteTicketType,
  listTicketTypes,
  moveTicketTypeDown,
  moveTicketTypeUp,
  TicketTypeInput,
  updateTicketType,
} from '../lib/api/ticket-types.api.js';

// Read constantly (ticket creation, attributes panel, report builder all
// depend on this) — a 60s staleTime matches useTicketStatuses/
// useTicketCategories, the closest analogous catalogs.
export function useTicketTypes() {
  return useQuery({
    queryKey: ['ticket-types'],
    queryFn: listTicketTypes,
    staleTime: 60_000,
  });
}

export function useCreateTicketType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TicketTypeInput) => createTicketType(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket-types'] }),
  });
}

export function useUpdateTicketType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<TicketTypeInput>) => updateTicketType(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket-types'] }),
  });
}

export function useDeleteTicketType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTicketType,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket-types'] }),
  });
}

export function useMoveTicketType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) =>
      direction === 'up' ? moveTicketTypeUp(id) : moveTicketTypeDown(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket-types'] }),
  });
}
