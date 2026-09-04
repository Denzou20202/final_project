import { decodeCursor, encodeCursor, JwtPayload, sanitizeArticleBody } from '@veloxdesk/common';
import { KnowledgeArticleStatus } from '@veloxdesk/types';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { S3Service } from '../article-images/s3.service.js';
import { ARTICLES_INDEX, ElasticsearchService } from '../elasticsearch/elasticsearch.service.js';
import { ArticlesRepository } from './articles.repository.js';
import { ArticleSearchResult, PublicArticle, PublicArticlePage, toPublicArticle } from './article.public.js';
import { CreateArticleDto } from './dto/create-article.dto.js';
import { ListArticlesQueryDto } from './dto/list-articles-query.dto.js';
import { UpdateArticleDto } from './dto/update-article.dto.js';
import { RateArticleDto } from './dto/rate-article.dto.js';

const DEFAULT_PAGE_SIZE = 20;
const ARTICLE_SEARCH_FIELDS = ['title', 'content'];

// sort='popular' offset cursor — kept local to this file rather than added
// to keyset-cursor.ts, which is shared across every other (createdAt, id)
// keyset consumer in the codebase and shouldn't grow a second, unrelated
// cursor shape. Opaque base64 like its sibling, for consistency, even
// though there's nothing sensitive in a plain offset number.
function encodeOffsetCursor(offset: number): string {
  return Buffer.from(String(offset), 'utf8').toString('base64url');
}

function decodeOffsetCursor(raw: string): number | null {
  const offset = Number(Buffer.from(raw, 'base64url').toString('utf8'));
  return Number.isInteger(offset) && offset >= 0 ? offset : null;
}

interface IndexedArticle {
  title: string;
  titleUk: string | null;
  titleEn: string | null;
  content: string;
  publishedAt: string;
  isPublic: boolean;
}

@Injectable()
export class ArticlesService {
  private readonly logger = new Logger(ArticlesService.name);

  constructor(
    private readonly articlesRepository: ArticlesRepository,
    private readonly elasticsearch: ElasticsearchService,
    private readonly s3: S3Service,
  ) {}

  async create(dto: CreateArticleDto, actor: JwtPayload): Promise<PublicArticle> {
    const article = await this.articlesRepository.create({
      title: dto.title,
      titleUk: dto.titleUk,
      titleEn: dto.titleEn,
      content: sanitizeArticleBody(dto.content),
      authorId: actor.sub,
      isPublic: dto.isPublic,
    });
    return toPublicArticle(article);
  }

  async list(query: ListArticlesQueryDto, isPublicOnly?: boolean): Promise<PublicArticlePage> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    // sort='popular' pages by plain offset, not the (createdAt, id) keyset
    // (see findPage's own comment on why viewCount ordering can't reuse
    // that cursor) — so it needs its own numeric cursor, encoded/decoded
    // separately from decodeCursor/encodeCursor's fixed {createdAt, id}
    // shape.
    const isPopular = query.sort === 'popular';
    const after = query.cursor
      ? isPopular
        ? this.parseOffsetCursor(query.cursor)
        : this.parseCursor(query.cursor)
      : undefined;

    const rows = await this.articlesRepository.findPage(limit, query.status, after, query.sort, isPublicOnly);
    const hasNextPage = rows.length > limit;
    const page = hasNextPage ? rows.slice(0, limit) : rows;
    const lastRow = page.at(-1);

    const nextCursor = !hasNextPage
      ? null
      : isPopular
        ? encodeOffsetCursor((typeof after === 'number' ? after : 0) + page.length)
        : lastRow
          ? encodeCursor({ createdAt: lastRow.createdAt, id: lastRow.id })
          : null;

    return {
      items: page.map(toPublicArticle),
      nextCursor,
    };
  }

  async findOne(id: string): Promise<PublicArticle> {
    const article = await this.getArticleOrThrow(id);
    return toPublicArticle(article);
  }

  async update(id: string, dto: UpdateArticleDto): Promise<PublicArticle> {
    await this.getArticleOrThrow(id);
    // Same guard as PermissionGroupsService/EmployeeStatusesService/
    // TeamsService.update — TypeORM's Repository.update() throws
    // UpdateValuesMissingError (an uncaught 500) when the SET clause would
    // be empty, e.g. a PATCH body of `{}`.
    const patch: Partial<{ title: string; titleUk: string; titleEn: string; content: string; isPublic: boolean }> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.titleUk !== undefined) patch.titleUk = dto.titleUk;
    if (dto.titleEn !== undefined) patch.titleEn = dto.titleEn;
    if (dto.content !== undefined) patch.content = sanitizeArticleBody(dto.content);
    if (dto.isPublic !== undefined) patch.isPublic = dto.isPublic;
    if (Object.keys(patch).length > 0) {
      await this.articlesRepository.update(id, patch);
    }
    const updated = toPublicArticle(await this.getArticleOrThrow(id));

    // Keep a published article's index entry in sync with edits — otherwise
    // search results would show stale title/content until the next publish.
    if (updated.status === KnowledgeArticleStatus.PUBLISHED) {
      await this.indexArticle(updated);
    }

    return updated;
  }

  async publish(id: string): Promise<PublicArticle> {
    const article = await this.getArticleOrThrow(id);
    const publishedAt = article.publishedAt ?? new Date();
    await this.articlesRepository.publish(id, publishedAt);
    const updated = toPublicArticle(await this.getArticleOrThrow(id));
    await this.indexArticle(updated);
    return updated;
  }

  async unpublish(id: string): Promise<PublicArticle> {
    await this.getArticleOrThrow(id);
    await this.articlesRepository.unpublish(id);
    await this.removeFromIndex(id);
    const updated = await this.getArticleOrThrow(id);
    return toPublicArticle(updated);
  }

  async remove(id: string): Promise<void> {
    const article = await this.getArticleOrThrow(id);
    await this.articlesRepository.delete(id);
    await this.removeFromIndex(id);
    // Best-effort — there's no join table tracking which S3 image keys an
    // article embeds (ArticleImagesService.upload never persists that
    // association anywhere), so this is the only way to find them: parse
    // the content HTML for the same /api/public/images/:key URLs the editor
    // itself inserted on upload. Doesn't catch keys orphaned by an EDIT that
    // removed an image reference without deleting the article — only the
    // delete-the-whole-article path, matching TicketsService.hardDelete's
    // scope for ticket attachments.
    await this.removeEmbeddedImages(article.content);
  }

  // Backs the client-facing FAQ page — published articles only, 404 (not
  // the draft content) for anything else. `includePrivate` is true only
  // when OptionalJwtAuthGuard resolved a real actor (any authenticated
  // client/operator/admin); a logged-out visitor gets the same 404 for a
  // private article as for a draft/missing one, so its existence isn't
  // leaked. Every successful read here is a real visitor viewing the
  // article, so this is also where the view counter bumps — incremented,
  // then reflected in the returned count without a second round-trip (the
  // entity object in hand is already one view stale by the time the atomic
  // UPDATE lands).
  async findPublishedOrThrow(id: string, includePrivate = false): Promise<PublicArticle> {
    const article = await this.getArticleOrThrow(id);
    if (article.status !== KnowledgeArticleStatus.PUBLISHED) {
      throw new NotFoundException('Article not found');
    }
    if (!article.isPublic && !includePrivate) {
      throw new NotFoundException('Article not found');
    }
    await this.articlesRepository.incrementViewCount(id);
    return { ...toPublicArticle(article), viewCount: article.viewCount + 1 };
  }

  // Anonymous — the public FAQ has no visitor identity to gate a vote on
  // (see the entity's own comment). Same published+visibility guard as
  // reading the article, so a rating can't be recorded against a
  // draft/private/removed one via a guessed id.
  async rate(id: string, dto: RateArticleDto, includePrivate = false): Promise<void> {
    const article = await this.getArticleOrThrow(id);
    if (article.status !== KnowledgeArticleStatus.PUBLISHED) {
      throw new NotFoundException('Article not found');
    }
    if (!article.isPublic && !includePrivate) {
      throw new NotFoundException('Article not found');
    }
    if (dto.helpful) {
      await this.articlesRepository.incrementHelpful(id);
    } else {
      await this.articlesRepository.incrementNotHelpful(id);
    }
  }

  // Ignores whatever status the caller passed — always forces published,
  // since this backs the public FAQ surface. `includePrivate` mirrors
  // findPublishedOrThrow: false (the default, anonymous visitor) restricts
  // the listing to isPublic articles only; true (an authenticated
  // client/operator/admin came through OptionalJwtAuthGuard) lifts that
  // restriction so private-but-published articles show up too.
  async listPublished(query: ListArticlesQueryDto, includePrivate = false): Promise<PublicArticlePage> {
    return this.list({ ...query, status: KnowledgeArticleStatus.PUBLISHED }, includePrivate ? undefined : true);
  }

  // The index only ever holds published articles (publish/unpublish/remove
  // keep it in sync), so no status filtering is needed at query time —
  // but it holds BOTH public and private ones, so an anonymous caller
  // (includePrivate=false) still needs the isPublic hits filtered out here.
  // Note this filters after the ES query runs at `size: limit`, so an
  // anonymous search can return fewer than `limit` results when some of
  // the top-scored hits are private — accepted, matches the "shared index,
  // post-query filter" tradeoff for this table's scale.
  async searchPublished(q: string, limit?: number, includePrivate = false): Promise<ArticleSearchResult[]> {
    const hits = await this.elasticsearch.search<IndexedArticle>(ARTICLES_INDEX, q, ARTICLE_SEARCH_FIELDS, limit);
    const visible = includePrivate ? hits : hits.filter((hit) => hit.source.isPublic);

    return visible.map((hit) => ({
      id: hit.id,
      title: hit.source.title,
      // Not searched/highlighted (only `title`/`content` are, both always
      // Russian — see ARTICLE_SEARCH_FIELDS) — these exist purely so the
      // frontend can pickLocalized() the same way the non-search article
      // listing already does, instead of always showing the Russian title
      // to a uk/en-locale visitor.
      titleUk: hit.source.titleUk ?? null,
      titleEn: hit.source.titleEn ?? null,
      score: hit.score,
      highlight: hit.highlight ?? {},
    }));
  }

  // Best-effort, same convention as AuthService.register's userEventsPublisher
  // call — the Postgres write (title/content, publish/unpublish/delete) is
  // already committed by the time either of these run, so an ES hiccup here
  // must not turn a successful request into a 500. Worst case: the article's
  // search entry is stale/missing until the next successful write touches
  // it; nothing about the article itself is lost.
  private async indexArticle(article: PublicArticle): Promise<void> {
    try {
      await this.elasticsearch.index(ARTICLES_INDEX, article.id, {
        title: article.title,
        titleUk: article.titleUk,
        titleEn: article.titleEn,
        content: article.content,
        publishedAt: article.publishedAt,
        isPublic: article.isPublic,
      });
    } catch (err) {
      this.logger.warn(`Failed to index article ${article.id}: ${err}`);
    }
  }

  private async removeFromIndex(id: string): Promise<void> {
    try {
      await this.elasticsearch.delete(ARTICLES_INDEX, id);
    } catch (err) {
      this.logger.warn(`Failed to remove article ${id} from index: ${err}`);
    }
  }

  // Same key charset PublicImagesController/ArticleImagesService's SAFE_KEY
  // check requires, so this only ever matches keys that could actually have
  // been uploaded through that flow.
  private async removeEmbeddedImages(content: string): Promise<void> {
    const keys = [...content.matchAll(/\/api\/public\/images\/([\w.-]+)/g)].map((m) => m[1]);
    await Promise.allSettled(keys.map((key) => this.s3.deleteObject(key)));
  }

  private async getArticleOrThrow(id: string) {
    const article = await this.articlesRepository.findById(id);
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return article;
  }

  private parseCursor(cursor: string) {
    try {
      return decodeCursor(cursor);
    } catch {
      throw new BadRequestException('Invalid pagination cursor');
    }
  }

  private parseOffsetCursor(cursor: string): number {
    const offset = decodeOffsetCursor(cursor);
    if (offset === null) {
      throw new BadRequestException('Invalid pagination cursor');
    }
    return offset;
  }
}
