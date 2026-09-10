import { KnowledgeArticleStatus } from '@veloxdesk/types';
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

// Regression coverage: ArticlesService.remove() used to only delete the
// Postgres row and the Elasticsearch doc, leaving every embedded S3 image
// permanently orphaned — there's no join table tracking which keys an
// article embeds, so this parses the content HTML for the same
// /api/public/images/:key URLs the editor itself inserted on upload.
describe('ArticlesService.remove — embedded S3 image cleanup', () => {
  let articlesRepository: { findById: jest.Mock; delete: jest.Mock };
  let elasticsearch: { delete: jest.Mock };
  let s3: { deleteObject: jest.Mock };
  let service: ArticlesService;

  beforeEach(() => {
    elasticsearch = { delete: jest.fn() };
    s3 = { deleteObject: jest.fn().mockResolvedValue(undefined) };
    articlesRepository = { findById: jest.fn(), delete: jest.fn() };
    service = new ArticlesService(articlesRepository as never, elasticsearch as never, s3 as never);
  });

  it('best-effort deletes every embedded image key found in the article content', async () => {
    articlesRepository.findById.mockResolvedValue(
      makeArticle({
        content:
          '<p>See <img src="/api/public/images/abc123.png"> and <img src="/api/public/images/def-456.jpg"></p>',
      }),
    );

    await service.remove('article-1');

    expect(s3.deleteObject).toHaveBeenCalledTimes(2);
    expect(s3.deleteObject).toHaveBeenCalledWith('abc123.png');
    expect(s3.deleteObject).toHaveBeenCalledWith('def-456.jpg');
  });

  it('does nothing S3-related when the article has no embedded images', async () => {
    articlesRepository.findById.mockResolvedValue(makeArticle({ content: '<p>No images here.</p>' }));

    await service.remove('article-1');

    expect(s3.deleteObject).not.toHaveBeenCalled();
  });

  it('does not let an S3 cleanup failure fail the whole delete', async () => {
    articlesRepository.findById.mockResolvedValue(
      makeArticle({ content: '<img src="/api/public/images/broken.png">' }),
    );
    s3.deleteObject.mockRejectedValue(new Error('S3 unreachable'));

    await expect(service.remove('article-1')).resolves.toBeUndefined();
    expect(articlesRepository.delete).toHaveBeenCalledWith('article-1');
  });
});
