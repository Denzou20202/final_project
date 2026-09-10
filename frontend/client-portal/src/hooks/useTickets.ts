import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTicket,
  fetchCsatSurvey,
  fetchTicket,
  fetchTicketActivity,
  fetchTicketCounts,
  fetchWatchStatus,
  listTickets,
  submitCsatSurvey,
  unwatchTicket,
  watchTicket,
} from '../lib/api/tickets.api.js';
import type { ListTicketsParams } from '../lib/types.js';

// One page at a time, not accumulated — backs TicketsPage's real pagination
// (page-size selector + Prev/Next), mirroring operator-app's identical
// pattern. `cursor` is caller-managed (a stack of cursors visited so far),
// since the backend only ever hands back a *next* cursor — there's no direct
// "jump to page N" without one.
export function useTicketsPage(filters: Omit<ListTicketsParams, 'cursor'>, cursor: string | undefined) {
  return useQuery({
    queryKey: ['tickets', 'page', filters, cursor],
    queryFn: () => listTickets({ ...filters, cursor }),
    // Keep the current rows on screen while the next page/filter result
    // loads — otherwise every Prev/Next click blanks the table into a
    // spinner for a beat before repainting.
    placeholderData: keepPreviousData,
  });
}

export function useTicketCounts(filters: Pick<ListTicketsParams, 'watching' | 'search' | 'assignedTo'> = {}) {
  return useQuery({
    queryKey: ['ticket-counts', filters],
    queryFn: () => fetchTicketCounts(filters),
    staleTime: 15_000,
  });
}

export function useTicket(id: string | undefined) {
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: () => fetchTicket(id as string),
    enabled: !!id,
  });
}

export function useTicketActivity(id: string | undefined) {
  return useQuery({
    queryKey: ['ticket', id, 'activity'],
    queryFn: () => fetchTicketActivity(id as string),
    enabled: !!id,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-counts'] });
    },
  });
}

function useTicketMutation<TArgs extends unknown[]>(
  mutationFn: (id: string, ...args: TArgs) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, args }: { id: string; args: TArgs }) => mutationFn(id, ...args),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ticket', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-counts'] });
    },
  });
}

export function useWatchTicket() {
  return useTicketMutation<[]>(watchTicket);
}

export function useUnwatchTicket() {
  return useTicketMutation<[]>(unwatchTicket);
}

// Prefix-matching invalidation in useTicketMutation's onSuccess
// (['ticket', id]) already covers this key too whenever a watch/unwatch
// mutation succeeds — no extra invalidation needed here.
export function useWatchStatus(ticketId: string | undefined) {
  return useQuery({
    queryKey: ['ticket', ticketId, 'watch'],
    queryFn: () => fetchWatchStatus(ticketId as string),
    enabled: !!ticketId,
  });
}

// enabled by the caller (ChatPanel) once the ticket is actually closed —
// before that there's no survey row on the backend at all, just a plain
// 'not_available'.
export function useCsat(ticketId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['ticket', ticketId, 'csat'],
    queryFn: () => fetchCsatSurvey(ticketId as string),
    enabled: !!ticketId && enabled,
  });
}

export function useSubmitCsat(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (answers: { questionId: string; score: number }[]) => submitCsatSurvey(ticketId, answers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId, 'csat'] });
    },
  });
}
