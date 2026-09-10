import { publicKnowledgeApi } from './client.js';
import type { PublicKnowledgeTheme } from '../types.js';

export async function fetchPublicKnowledgeTheme(): Promise<PublicKnowledgeTheme> {
  const { data } = await publicKnowledgeApi.get<PublicKnowledgeTheme>('/public/knowledge-theme');
  return data;
}
