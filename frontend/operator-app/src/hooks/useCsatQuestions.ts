import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCsatQuestion,
  deleteCsatQuestion,
  listCsatQuestions,
  updateCsatQuestion,
} from '../lib/api/csat-questions.api.js';

export function useCsatQuestions() {
  return useQuery({
    queryKey: ['csat-questions'],
    queryFn: listCsatQuestions,
    staleTime: 60_000,
  });
}

export function useCreateCsatQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCsatQuestion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['csat-questions'] }),
  });
}

export function useUpdateCsatQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Parameters<typeof updateCsatQuestion>[1] & { id: string }) =>
      updateCsatQuestion(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['csat-questions'] }),
  });
}

export function useDeleteCsatQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCsatQuestion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['csat-questions'] }),
  });
}
