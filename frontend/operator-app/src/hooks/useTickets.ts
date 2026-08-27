import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TicketPriority } from '@veloxdesk/types';
import {
  assignTicket,
  assignTicketTeam,
  createTicket,
  deleteTicket,
  fetchCsatSurvey,
  fetchTicket,
  fetchTicketActivity,
  fetchTicketCounts,
  fetchTicketCountsByTag,
  fetchTicketCountsByTeam,
  fetchTrash,
  fetchWatchStatus,
  listTickets,
  mergeTicket,
  restoreTicket,
  sendStatusEmail,
  unwatchTicket,
  updateTicketCategory,
  updateTicketPriority,
  updateTicketStatus,
  updateTicketType,
  watchTicket,
} from '../lib/api/tickets.api.js';
import type { ListTicketsParams } from '../lib/types.js';

export function useTicketsList(filters: Omit<ListTicketsParams, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: ['tickets', filters],
    queryFn: ({ pageParam }) => listTickets({ ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

// One page at a time, not accumulated — backs TicketsPage's real
// pagination (page-size selector + Prev/Next), as opposed to
// useTicketsList's "load more keeps appending" model used by
// ClientHistoryModal. `cursor` is caller-managed (a stack of cursors
// visited so far), since the backend only ever hands back a *next* cursor —
// there's no direct "jump to page N" without one.
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

export function useTicketCounts(
  filters: Pick<ListTicketsParams, 'priority' | 'assignedTo' | 'teamId' | 'tagId' | 'watching' | 'mentioned' | 'search'> = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ['ticket-counts', filters],
    queryFn: () => fetchTicketCounts(filters),
    staleTime: 15_000,
    enabled: options.enabled ?? true,
  });
}

// Backs the sidebar's per-team accordion — one request for every team's
// counts, instead of the sidebar calling useTicketCounts({ teamId }) once
// per rendered team (see fetchTicketCountsByTeam).
export function useTicketCountsByTeam() {
  return useQuery({
    queryKey: ['ticket-counts', 'by-team'],
    queryFn: fetchTicketCountsByTeam,
    staleTime: 15_000,
  });
}

export function useTicketCountsByTag() {
  return useQuery({
    queryKey: ['ticket-counts', 'by-tag'],
    queryFn: fetchTicketCountsByTag,
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

// enabled by the caller once the ticket is actually closed — before that
// there's no survey row on the backend, just a plain 'not_available'.
export function useCsat(ticketId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['ticket', ticketId, 'csat'],
    queryFn: () => fetchCsatSurvey(ticketId as string),
    enabled: !!ticketId && enabled,
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
  options: { alsoInvalidate?: unknown[][] } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, args }: { id: string; args: TArgs }) => mutationFn(id, ...args),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ticket', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      // Status/assignee changes shift which folder/badge a ticket counts
      // under — cheap to always refresh, no need to special-case which
      // mutation actually changed status.
      queryClient.invalidateQueries({ queryKey: ['ticket-counts'] });
      // Trash deliberately lives outside the ['tickets'] prefix (see
      // useTrash) so it ISN'T swept up by the invalidation above — every
      // status/priority/assignee/etc. mutation used to also force-refetch
      // it despite none of those touching trash contents, and it's mounted
      // in the sidebar at all times. Only delete/restore opt back in below.
      options.alsoInvalidate?.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    },
  });
}

export function useUpdateTicketStatus() {
  return useTicketMutation<[string]>(updateTicketStatus);
}

export function useUpdateTicketPriority() {
  return useTicketMutation<[TicketPriority]>(updateTicketPriority);
}

export function useAssignTicket() {
  return useTicketMutation<[string]>(assignTicket);
}

export function useAssignTicketTeam() {
  return useTicketMutation<[string]>(assignTicketTeam);
}

export function useUpdateTicketType() {
  return useTicketMutation<[string]>(updateTicketType);
}

// null clears the ticket's category back to "none" — see AssignCategoryDto.
export function useUpdateTicketCategory() {
  return useTicketMutation<[string | null]>(updateTicketCategory);
}

export function useMergeTicket() {
  return useTicketMutation<[string]>(mergeTicket);
}

export function useDeleteTicket() {
  return useTicketMutation<[]>(deleteTicket, { alsoInvalidate: [['trash']] });
}

export function useRestoreTicket() {
  return useTicketMutation<[]>(restoreTicket, { alsoInvalidate: [['trash']] });
}

export function useWatchTicket() {
  return useTicketMutation<[]>(watchTicket);
}

export function useUnwatchTicket() {
  return useTicketMutation<[]>(unwatchTicket);
}

export function useSendStatusEmail() {
  return useTicketMutation<[]>(sendStatusEmail);
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

export function useTrash(options: { enabled?: boolean } = {}) {
  return useQuery({
    // Not ['tickets', 'trash'] — that prefix is exactly what
    // useTicketMutation's blanket ['tickets'] invalidation matches, and
    // trash is mounted at all times in the sidebar. See useDeleteTicket/
    // useRestoreTicket for the two mutations that actually invalidate this.
    queryKey: ['trash'],
    queryFn: fetchTrash,
    enabled: options.enabled ?? true,
  });
}
