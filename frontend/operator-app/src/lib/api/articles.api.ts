import type { KnowledgeArticleStatus } from '@veloxdesk/types';
import { knowledgeApi } from './client.js';
import type { PublicArticle, PublicArticlePage } from '../types.js';

export async function listArticles(params: {
  status?: KnowledgeArticleStatus;
  cursor?: string;
  limit?: number;
}): Promise<PublicArticlePage> {
  const { data } = await knowledgeApi.get<PublicArticlePage>('/articles', { params });
  return data;
}

export async function fetchArticle(id: string): Promise<PublicArticle> {
  const { data } = await knowledgeApi.get<PublicArticle>(`/articles/${id}`);
  return data;
}

export async function createArticle(input: {
  title: string;
  titleUk?: string;
  titleEn?: string;
  content: string;
  isPublic?: boolean;
}): Promise<PublicArticle> {
  const { data } = await knowledgeApi.post<PublicArticle>('/articles', input);
  return data;
}

export async function updateArticle(
  id: string,
  input: { title?: string; titleUk?: string; titleEn?: string; content?: string; isPublic?: boolean },
): Promise<PublicArticle> {
  const { data } = await knowledgeApi.patch<PublicArticle>(`/articles/${id}`, input);
  return data;
}

export async function publishArticle(id: string): Promise<PublicArticle> {
  const { data } = await knowledgeApi.patch<PublicArticle>(`/articles/${id}/publish`);
  return data;
}

export async function unpublishArticle(id: string): Promise<PublicArticle> {
  const { data } = await knowledgeApi.patch<PublicArticle>(`/articles/${id}/unpublish`);
  return data;
}

export async function deleteArticle(id: string): Promise<void> {
  await knowledgeApi.delete(`/articles/${id}`);
}
