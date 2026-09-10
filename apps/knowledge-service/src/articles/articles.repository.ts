import { KeysetCursor } from '@veloxdesk/common';
import { KnowledgeArticleEntity } from '@veloxdesk/database';
import { KnowledgeArticleStatus } from '@veloxdesk/types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export type ArticleSort = 'recent' | 'popular';

@Injectable()
export class ArticlesRepository {
  constructor(
    @InjectRepository(KnowledgeArticleEntity)
    private readonly repository: Repository<KnowledgeArticleEntity>,
  ) {}

  create(data: {
    title: string;
    titleUk?: string;
    titleEn?: string;
    content: string;
    authorId: string;
    isPublic?: boolean;
  }): Promise<KnowledgeArticleEntity> {
    const article = this.repository.create({
      ...data,
      status: KnowledgeArticleStatus.DRAFT,
      isPublic: data.isPublic ?? false,
    });
    return this.repository.save(article);
  }

  findById(id: string): Promise<KnowledgeArticleEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  // Fetches `limit + 1` rows so the caller can tell whether a next page
  // exists without a separate COUNT(*) query.
  //
  // sort='recent' keysets on (createdAt, id) as usual. sort='popular' CANNOT
  // reuse that same keyset — it orders by viewCount, but a (createdAt, id) <
  // (cursor) WHERE clause filters on a column that has nothing to do with
  // that order. That's not just "imprecise ordering across pages", it's
  // silent row loss: any article whose createdAt happens to be more recent
  // than the previous page's last row is excluded from every later page
  // forever, regardless of its actual view count, since the cursor keeps
  // narrowing on the wrong axis. 'popular' therefore pages by plain offset
  // instead — correct as long as view counts don't change dramatically
  // between page loads, a fine tradeoff for a "browse popular articles"
  // list (mirrors how the reports UI already accepts eventual consistency
  // over exact-rank stability for browsing-not-auditing use cases).
  findPage(
    limit: number,
    status: KnowledgeArticleStatus | undefined,
    after: KeysetCursor | number | undefined,
    sort: ArticleSort = 'recent',
    isPublicOnly?: boolean,
  ): Promise<KnowledgeArticleEntity[]> {
    const qb = this.repository.createQueryBuilder('article');

    if (status) {
      qb.andWhere('article.status = :status', { status });
    }

    if (isPublicOnly) {
      qb.andWhere('article.isPublic = true');
    }

    if (sort === 'popular') {
      const offset = typeof after === 'number' ? after : 0;
      qb.orderBy('article.viewCount', 'DESC')
        .addOrderBy('article.createdAt', 'DESC')
        .addOrderBy('article.id', 'DESC')
        .skip(offset)
        .take(limit + 1);
      return qb.getMany();
    }

    qb.orderBy('article.createdAt', 'DESC').addOrderBy('article.id', 'DESC').take(limit + 1);
    if (after && typeof after !== 'number') {
      qb.andWhere('(article.createdAt, article.id) < (:createdAt, :id)', {
        createdAt: after.createdAt,
        id: after.id,
      });
    }

    return qb.getMany();
  }

  // Atomic UPDATE, not read-modify-write — see the entity's own comment on
  // why that matters for concurrent viewers.
  async incrementViewCount(id: string): Promise<void> {
    await this.repository.increment({ id }, 'viewCount', 1);
  }

  async incrementHelpful(id: string): Promise<void> {
    await this.repository.increment({ id }, 'helpfulCount', 1);
  }

  async incrementNotHelpful(id: string): Promise<void> {
    await this.repository.increment({ id }, 'notHelpfulCount', 1);
  }

  async update(
    id: string,
    data: { title?: string; titleUk?: string; titleEn?: string; content?: string; isPublic?: boolean },
  ): Promise<void> {
    await this.repository.update({ id }, data);
  }

  async publish(id: string, publishedAt: Date): Promise<void> {
    await this.repository.update({ id }, { status: KnowledgeArticleStatus.PUBLISHED, publishedAt });
  }

  async unpublish(id: string): Promise<void> {
    // TypeORM's update() treats `undefined` as "leave this column alone" —
    // it must be `null` to actually clear published_at in the row.
    await this.repository.update({ id }, { status: KnowledgeArticleStatus.DRAFT, publishedAt: null });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
