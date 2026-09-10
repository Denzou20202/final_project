import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCity, deleteCity, listCities, renameCity } from '../lib/api/cities.api.js';

export function useCities() {
  return useQuery({
    queryKey: ['cities'],
    queryFn: listCities,
    staleTime: 60_000,
  });
}

export function useCreateCity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createCity(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cities'] }),
  });
}

export function useRenameCity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameCity(id, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cities'] }),
  });
}

export function useDeleteCity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCity,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cities'] }),
  });
}
