import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createMacro, deleteMacro, listMacros, updateMacro } from '../lib/api/macros.api.js';

export function useMacros() {
  return useQuery({
    queryKey: ['macros'],
    queryFn: listMacros,
    staleTime: 60_000,
  });
}

export function useCreateMacro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createMacro,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['macros'] }),
  });
}

export function useUpdateMacro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Parameters<typeof updateMacro>[1] & { id: string }) => updateMacro(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['macros'] }),
  });
}

export function useDeleteMacro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteMacro,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['macros'] }),
  });
}
