import { useQuery } from '@tanstack/react-query';
import { searchTickets } from '../lib/api/search.api.js';

export function useTicketSearch(q: string) {
  return useQuery({
    queryKey: ['search', 'tickets', q],
    queryFn: () => searchTickets(q),
    enabled: q.trim().length > 0,
  });
}
