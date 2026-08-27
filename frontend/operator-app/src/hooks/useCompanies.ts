import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCompany, deleteCompany, listCompanies, renameCompany } from '../lib/api/companies.api.js';

export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
    staleTime: 60_000,
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createCompany(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companies'] }),
  });
}

export function useRenameCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameCompany(id, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companies'] }),
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCompany,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companies'] }),
  });
}
