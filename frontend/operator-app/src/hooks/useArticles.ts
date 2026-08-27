import type { KnowledgeArticleStatus } from '@veloxdesk/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createArticle,
  deleteArticle,
  fetchArticle,
  listArticles,
  publishArticle,
  unpublishArticle,
  updateArticle,
} from '../lib/api/articles.api.js';

export function useArticlesList(status?: KnowledgeArticleStatus, limit?: number) {
  return useQuery({
    queryKey: ['articles', { status, limit }],
    queryFn: () => listArticles({ status, limit }),
  });
}

export function useArticle(id: string | undefined) {
  return useQuery({
    queryKey: ['article', id],
    queryFn: () => fetchArticle(id as string),
    enabled: !!id,
  });
}

export function useCreateArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createArticle,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['articles'] }),
  });
}

export function useUpdateArticle(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { title?: string; titleUk?: string; titleEn?: string; content?: string; isPublic?: boolean }) =>
      updateArticle(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', id] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });
}

export function usePublishArticle(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => publishArticle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', id] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });
}

export function useUnpublishArticle(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unpublishArticle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', id] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });
}

export function useDeleteArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteArticle,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['articles'] }),
  });
}
