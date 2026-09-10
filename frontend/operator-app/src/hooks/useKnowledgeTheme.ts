import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchKnowledgeTheme, updateKnowledgeTheme } from '../lib/api/knowledge-theme.api.js';

export function useKnowledgeTheme() {
  return useQuery({
    queryKey: ['knowledge-theme'],
    queryFn: fetchKnowledgeTheme,
  });
}

export function useUpdateKnowledgeTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateKnowledgeTheme,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge-theme'] }),
  });
}
