import { KnowledgeArticleStatus } from '@veloxdesk/types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { ArticleSort } from '../articles.repository.js';

export class ListArticlesQueryDto {
  @ApiPropertyOptional({ enum: KnowledgeArticleStatus })
  @IsOptional()
  @IsEnum(KnowledgeArticleStatus)
  status?: KnowledgeArticleStatus;

  // 'popular' orders by viewCount — backs the FAQ's «Популярные статьи»;
  // defaults to 'recent' (createdAt DESC, unchanged from before this existed).
  @ApiPropertyOptional({ enum: ['recent', 'popular'] })
  @IsOptional()
  @IsIn(['recent', 'popular'])
  sort?: ArticleSort;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Opaque cursor from the previous page\'s nextCursor' })
  @IsOptional()
  @IsString()
  cursor?: string;
}
