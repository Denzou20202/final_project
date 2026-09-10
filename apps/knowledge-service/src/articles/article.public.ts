import { KnowledgeArticleEntity } from '@veloxdesk/database';
import { KnowledgeArticleStatus } from '@veloxdesk/types';

export interface PublicArticle {
  id: string;
  title: string;
  titleUk: string | null;
  titleEn: string | null;
  content: string;
  authorId: string;
  status: KnowledgeArticleStatus;
  isPublic: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
}

export interface PublicArticlePage {
  items: PublicArticle[];
  nextCursor: string | null;
}

export interface ArticleSearchResult {
  id: string;
  title: string;
  titleUk: string | null;
  titleEn: string | null;
  score: number | null;
  highlight: Record<string, string[]>;
}

export function toPublicArticle(article: KnowledgeArticleEntity): PublicArticle {
  return {
    id: article.id,
    title: article.title,
    titleUk: article.titleUk ?? null,
    titleEn: article.titleEn ?? null,
    content: article.content,
    authorId: article.authorId,
    status: article.status,
    isPublic: article.isPublic,
    publishedAt: article.publishedAt ?? null,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    viewCount: article.viewCount,
    helpfulCount: article.helpfulCount,
    notHelpfulCount: article.notHelpfulCount,
  };
}
