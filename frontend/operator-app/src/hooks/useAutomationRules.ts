import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAutomationRule,
  deleteAutomationRule,
  listAutomationRules,
  updateAutomationRule,
} from '../lib/api/automation-rules.api.js';

export function useAutomationRules() {
  return useQuery({
    queryKey: ['automation-rules'],
    queryFn: listAutomationRules,
    staleTime: 60_000,
  });
}

export function useCreateAutomationRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAutomationRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automation-rules'] }),
  });
}

export function useUpdateAutomationRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Parameters<typeof updateAutomationRule>[1] & { id: string }) =>
      updateAutomationRule(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automation-rules'] }),
  });
}

export function useDeleteAutomationRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAutomationRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automation-rules'] }),
  });
}
