import { knowledgeApi } from './client.js';

// Matches ALLOWED_IMAGE_MIME_TYPES / MAX_IMAGE_SIZE_BYTES in
// knowledge-service's article-images.controller.ts — shared by every
// consumer of this upload endpoint (KB article editor, macro editor, chat
// reply composer) instead of each one hardcoding its own copy.
export const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
export const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024;

export async function uploadArticleImage(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await knowledgeApi.post<{ url: string }>('/articles/images', form);
  return data;
}
