import { useQuery } from '@tanstack/react-query';
import { listTicketStatuses } from '../lib/api/ticket-statuses.api.js';

export function useTicketStatuses() {
  return useQuery({
    queryKey: ['ticket-statuses'],
    queryFn: listTicketStatuses,
    staleTime: 60_000,
  });
}
