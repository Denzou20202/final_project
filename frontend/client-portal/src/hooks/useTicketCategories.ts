import { useQuery } from '@tanstack/react-query';
import { listTicketCategories } from '../lib/api/ticket-categories.api.js';

export function useTicketCategories() {
  return useQuery({
    queryKey: ['ticket-categories'],
    queryFn: listTicketCategories,
    staleTime: 60_000,
  });
}
