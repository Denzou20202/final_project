import { knowledgeApi } from './client.js';
import type { PublicKnowledgeTheme } from '../types.js';

export async function fetchKnowledgeTheme(): Promise<PublicKnowledgeTheme> {
  const { data } = await knowledgeApi.get<PublicKnowledgeTheme>('/knowledge-theme');
  return data;
}

export async function updateKnowledgeTheme(input: { customCss: string; customJs: string }): Promise<PublicKnowledgeTheme> {
  const { data } = await knowledgeApi.patch<PublicKnowledgeTheme>('/knowledge-theme', input);
  return data;
}
