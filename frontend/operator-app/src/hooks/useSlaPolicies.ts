import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSlaPolicy, deleteSlaPolicy, listSlaPolicies, updateSlaPolicy } from '../lib/api/sla-policies.api.js';

export function useSlaPolicies() {
  return useQuery({
    queryKey: ['sla-policies'],
    queryFn: listSlaPolicies,
  });
}

export function useCreateSlaPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSlaPolicy,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sla-policies'] }),
  });
}

export function useUpdateSlaPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Parameters<typeof updateSlaPolicy>[1] & { id: string }) => updateSlaPolicy(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sla-policies'] }),
  });
}

export function useDeleteSlaPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteSlaPolicy,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sla-policies'] }),
  });
}
