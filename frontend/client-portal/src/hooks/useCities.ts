import { useQuery } from '@tanstack/react-query';
import { listCities } from '../lib/api/cities.api.js';

export function useCities() {
  return useQuery({
    queryKey: ['cities'],
    queryFn: listCities,
    staleTime: 60_000,
  });
}
