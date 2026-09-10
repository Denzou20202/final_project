import { useMutation, useQuery } from '@tanstack/react-query';
import {
  fetchPublishedArticle,
  listPublishedArticles,
  rateArticle,
  searchPublishedArticles,
} from '../lib/api/articles.api.js';

export function usePublishedArticles(sort?: 'recent' | 'popular') {
  return useQuery({
    queryKey: ['public-articles', sort],
    queryFn: () => listPublishedArticles(sort),
  });
}

export function usePublishedArticle(id: string | undefined) {
  return useQuery({
    queryKey: ['public-article', id],
    queryFn: () => fetchPublishedArticle(id as string),
    enabled: !!id,
    // GET /public/articles/:id also bumps the view counter server-side —
    // without a long staleTime, react-query's default refetch-on-window-
    // focus would silently inflate it every time a visitor tabs away and
    // back while reading the same article. One increment per page visit.
    staleTime: Infinity,
  });
}

export function useArticleSearch(q: string) {
  return useQuery({
    queryKey: ['public-article-search', q],
    queryFn: () => searchPublishedArticles(q),
    enabled: q.trim().length > 0,
  });
}

// Deliberately doesn't invalidate/refetch the article query on success —
// re-fetching GET /public/articles/:id would bump the view counter again
// as a side effect (that endpoint is also where views are counted), and
// the visitor-facing widget doesn't display the raw counts anyway (see
// FaqArticlePage), just a thank-you state — so there's nothing to refresh.
export function useRateArticle(id: string) {
  return useMutation({
    mutationFn: (helpful: boolean) => rateArticle(id, helpful),
  });
}
