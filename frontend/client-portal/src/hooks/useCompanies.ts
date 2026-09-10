import { useQuery } from '@tanstack/react-query';
import { listCompanies } from '../lib/api/companies.api.js';

export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
    staleTime: 60_000,
  });
}
