import { KnowledgeArticleStatus } from '@veloxdesk/types';
import { NotFoundException } from '@nestjs/common';
import { ArticlesService } from './articles.service.js';

function makeArticle(overrides: Record<string, unknown> = {}) {
  return {
    id: 'article-1',
    title: 'Как сбросить пароль',
    content: 'Инструкция...',
    status: KnowledgeArticleStatus.DRAFT,
    authorId: 'admin-1',
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
    isPublic: false,
    ...overrides,
  };
}

describe('ArticlesService.update — empty patch guard', () => {
  let articlesRepository: { findById: jest.Mock; update: jest.Mock };
  let elasticsearch: { index: jest.Mock; delete: jest.Mock };
  let service: ArticlesService;

  beforeEach(() => {
    articlesRepository = { findById: jest.fn().mockResolvedValue(makeArticle()), update: jest.fn() };
    elasticsearch = { index: jest.fn(), delete: jest.fn() };
    service = new ArticlesService(articlesRepository as never, elasticsearch as never, {} as never);
  });

  it('does not call repository.update for an empty PATCH body (would throw UpdateValuesMissingError)', async () => {
    await service.update('article-1', {});

    expect(articlesRepository.update).not.toHaveBeenCalled();
  });

  it('still calls repository.update when a field is actually provided', async () => {
    await service.update('article-1', { title: 'Новое название' });

    expect(articlesRepository.update).toHaveBeenCalledWith('article-1', { title: 'Новое название' });
  });
});

describe('ArticlesService.findPublishedOrThrow — view counting', () => {
  let articlesRepository: { findById: jest.Mock; incrementViewCount: jest.Mock };
  let service: ArticlesService;

  beforeEach(() => {
    articlesRepository = { findById: jest.fn(), incrementViewCount: jest.fn() };
    service = new ArticlesService(articlesRepository as never, {} as never, {} as never);
  });

  it('rejects a draft article the same as a missing one', async () => {
    articlesRepository.findById.mockResolvedValue(makeArticle({ status: KnowledgeArticleStatus.DRAFT }));
    await expect(service.findPublishedOrThrow('article-1')).rejects.toThrow(NotFoundException);
    expect(articlesRepository.incrementViewCount).not.toHaveBeenCalled();
  });

  it('atomically increments the view count and reflects it in the response without a second read', async () => {
    articlesRepository.findById.mockResolvedValue(
      makeArticle({ status: KnowledgeArticleStatus.PUBLISHED, viewCount: 41, isPublic: true }),
    );
    const result = await service.findPublishedOrThrow('article-1');

    expect(articlesRepository.incrementViewCount).toHaveBeenCalledWith('article-1');
    expect(result.viewCount).toBe(42);
  });

  it('rejects an anonymous request for a published-but-private article', async () => {
    articlesRepository.findById.mockResolvedValue(
      makeArticle({ status: KnowledgeArticleStatus.PUBLISHED, isPublic: false }),
    );
    await expect(service.findPublishedOrThrow('article-1')).rejects.toThrow(NotFoundException);
    expect(articlesRepository.incrementViewCount).not.toHaveBeenCalled();
  });

  it('allows an authenticated caller (includePrivate=true) to read a published-but-private article', async () => {
    articlesRepository.findById.mockResolvedValue(
      makeArticle({ status: KnowledgeArticleStatus.PUBLISHED, isPublic: false, viewCount: 5 }),
    );
    const result = await service.findPublishedOrThrow('article-1', true);

    expect(articlesRepository.incrementViewCount).toHaveBeenCalledWith('article-1');
    expect(result.viewCount).toBe(6);
  });
});

describe('ArticlesService.rate', () => {
  let articlesRepository: { findById: jest.Mock; incrementHelpful: jest.Mock; incrementNotHelpful: jest.Mock };
  let service: ArticlesService;

  beforeEach(() => {
    articlesRepository = { findById: jest.fn(), incrementHelpful: jest.fn(), incrementNotHelpful: jest.fn() };
    service = new ArticlesService(articlesRepository as never, {} as never, {} as never);
  });

  it('rejects rating a non-published article', async () => {
    articlesRepository.findById.mockResolvedValue(makeArticle({ status: KnowledgeArticleStatus.DRAFT }));
    await expect(service.rate('article-1', { helpful: true })).rejects.toThrow(NotFoundException);
    expect(articlesRepository.incrementHelpful).not.toHaveBeenCalled();
  });

  it('increments helpfulCount when helpful=true', async () => {
    articlesRepository.findById.mockResolvedValue(
      makeArticle({ status: KnowledgeArticleStatus.PUBLISHED, isPublic: true }),
    );
    await service.rate('article-1', { helpful: true });
    expect(articlesRepository.incrementHelpful).toHaveBeenCalledWith('article-1');
    expect(articlesRepository.incrementNotHelpful).not.toHaveBeenCalled();
  });

  it('increments notHelpfulCount when helpful=false', async () => {
    articlesRepository.findById.mockResolvedValue(
      makeArticle({ status: KnowledgeArticleStatus.PUBLISHED, isPublic: true }),
    );
    await service.rate('article-1', { helpful: false });
    expect(articlesRepository.incrementNotHelpful).toHaveBeenCalledWith('article-1');
    expect(articlesRepository.incrementHelpful).not.toHaveBeenCalled();
  });

  it('rejects an anonymous rate on a published-but-private article', async () => {
    articlesRepository.findById.mockResolvedValue(
      makeArticle({ status: KnowledgeArticleStatus.PUBLISHED, isPublic: false }),
    );
    await expect(service.rate('article-1', { helpful: true })).rejects.toThrow(NotFoundException);
    expect(articlesRepository.incrementHelpful).not.toHaveBeenCalled();
  });

  it('allows an authenticated rate (includePrivate=true) on a published-but-private article', async () => {
    articlesRepository.findById.mockResolvedValue(
      makeArticle({ status: KnowledgeArticleStatus.PUBLISHED, isPublic: false }),
    );
    await service.rate('article-1', { helpful: true }, true);
    expect(articlesRepository.incrementHelpful).toHaveBeenCalledWith('article-1');
  });
});

describe('ArticlesService.listPublished — anonymous vs authenticated visibility', () => {
  let articlesRepository: { findPage: jest.Mock };
  let service: ArticlesService;

  beforeEach(() => {
    articlesRepository = { findPage: jest.fn().mockResolvedValue([]) };
    service = new ArticlesService(articlesRepository as never, {} as never, {} as never);
  });

  it('restricts an anonymous listing to public articles only', async () => {
    await service.listPublished({});
    expect(articlesRepository.findPage).toHaveBeenCalledWith(
      20,
      KnowledgeArticleStatus.PUBLISHED,
      undefined,
      undefined,
      true,
    );
  });

  it('lifts the isPublic restriction for an authenticated caller', async () => {
    await service.listPublished({}, true);
    expect(articlesRepository.findPage).toHaveBeenCalledWith(
      20,
      KnowledgeArticleStatus.PUBLISHED,
      undefined,
      undefined,
      undefined,
    );
  });
});

describe('ArticlesService.list — popular-sort offset pagination', () => {
  let articlesRepository: { findPage: jest.Mock };
  let service: ArticlesService;

  function makeRow(n: number) {
    return makeArticle({ id: `article-${n}`, viewCount: 100 - n, createdAt: new Date(2026, 0, n) });
  }

  beforeEach(() => {
    articlesRepository = { findPage: jest.fn() };
    service = new ArticlesService(articlesRepository as never, {} as never, {} as never);
  });

  it('requests offset 0 for the first popular page and encodes the next offset as the cursor', async () => {
    // limit + 1 rows returned signals a next page exists (per findPage's
    // own contract) — 3 rows for a limit of 2.
    articlesRepository.findPage.mockResolvedValue([makeRow(1), makeRow(2), makeRow(3)]);

    const page = await service.list({ sort: 'popular', limit: 2 });

    expect(articlesRepository.findPage).toHaveBeenCalledWith(2, undefined, undefined, 'popular', undefined);
    expect(page.items.map((a) => a.id)).toEqual(['article-1', 'article-2']);
    expect(page.nextCursor).not.toBeNull();
  });

  it('decodes a previous popular-page cursor back into the same numeric offset and advances it further — the actual pagination round trip', async () => {
    articlesRepository.findPage.mockResolvedValueOnce([makeRow(1), makeRow(2), makeRow(3)]);
    const firstPage = await service.list({ sort: 'popular', limit: 2 });
    if (!firstPage.nextCursor) throw new Error('expected a next cursor');
    const cursor = firstPage.nextCursor;

    articlesRepository.findPage.mockResolvedValueOnce([makeRow(3), makeRow(4)]);
    const secondPage = await service.list({ sort: 'popular', limit: 2, cursor });

    // Before the fix, `after` here was always the (createdAt, id) keyset
    // object 'popular' can't use, silently coerced to offset 0 by
    // findPage's own `typeof after === 'number' ? after : 0` — so this call
    // would have received 0 again instead of 2, returning the same first
    // page forever.
    expect(articlesRepository.findPage).toHaveBeenLastCalledWith(2, undefined, 2, 'popular', undefined);
    expect(secondPage.items.map((a) => a.id)).toEqual(['article-3', 'article-4']);
  });

  it('rejects a cursor that does not decode to a valid non-negative integer offset', async () => {
    await expect(
      service.list({ sort: 'popular', limit: 2, cursor: Buffer.from('not-a-number').toString('base64url') }),
    ).rejects.toThrow('Invalid pagination cursor');
  });
});

describe('ArticlesService.searchPublished — anonymous vs authenticated visibility', () => {
  let elasticsearch: { search: jest.Mock };
  let service: ArticlesService;

  beforeEach(() => {
    elasticsearch = {
      search: jest.fn().mockResolvedValue([
        { id: 'public-1', score: 1, source: { title: 'Public', isPublic: true }, highlight: {} },
        { id: 'private-1', score: 0.9, source: { title: 'Private', isPublic: false }, highlight: {} },
      ]),
    };
    service = new ArticlesService({} as never, elasticsearch as never, {} as never);
  });

  it('filters private hits out for an anonymous searcher', async () => {
    const results = await service.searchPublished('q');
    expect(results.map((r) => r.id)).toEqual(['public-1']);
  });

  it('keeps private hits for an authenticated searcher', async () => {
    const results = await service.searchPublished('q', undefined, true);
    expect(results.map((r) => r.id)).toEqual(['public-1', 'private-1']);
  });

  // Regression test: search results used to always carry only the Russian
  // `title`, so a uk/en-locale visitor's search hits displayed in Russian
  // regardless of locale (unlike the non-search article listing, which
  // already exposes titleUk/titleEn for pickLocalized). Passes through
  // whatever the index has, defaulting to null when absent.
  it('passes titleUk/titleEn through so the frontend can localize the result', async () => {
    elasticsearch.search.mockResolvedValue([
      { id: 'a', score: 1, source: { title: 'RU', titleUk: 'UK', titleEn: 'EN', isPublic: true }, highlight: {} },
      { id: 'b', score: 1, source: { title: 'RU only', isPublic: true }, highlight: {} },
    ]);

    const results = await service.searchPublished('q');

    expect(results[0]).toMatchObject({ title: 'RU', titleUk: 'UK', titleEn: 'EN' });
    expect(results[1]).toMatchObject({ title: 'RU only', titleUk: null, titleEn: null });
  });
});
