import { publicKnowledgeApi } from './client.js';
import type { ArticleSearchResult, PublicArticle, PublicArticlePage } from '../types.js';

export async function listPublishedArticles(sort?: 'recent' | 'popular', cursor?: string): Promise<PublicArticlePage> {
  const { data } = await publicKnowledgeApi.get<PublicArticlePage>('/public/articles', { params: { sort, cursor } });
  return data;
}

export async function fetchPublishedArticle(id: string): Promise<PublicArticle> {
  const { data } = await publicKnowledgeApi.get<PublicArticle>(`/public/articles/${id}`);
  return data;
}

export async function searchPublishedArticles(q: string): Promise<ArticleSearchResult[]> {
  const { data } = await publicKnowledgeApi.get<ArticleSearchResult[]>('/public/articles/search', { params: { q } });
  return data;
}

export async function rateArticle(id: string, helpful: boolean): Promise<void> {
  await publicKnowledgeApi.post(`/public/articles/${id}/rate`, { helpful });
}
