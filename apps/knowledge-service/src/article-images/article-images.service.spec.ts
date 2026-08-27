import { ArticleImagesService } from './article-images.service.js';

function makeFile(originalname: string, overrides: Record<string, unknown> = {}) {
  return {
    originalname,
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('fake-image-bytes'),
    ...overrides,
  };
}

describe('ArticleImagesService.upload — key sanitization matches getImage\'s SAFE_KEY check', () => {
  let s3Service: { upload: jest.Mock };
  let service: ArticleImagesService;

  beforeEach(() => {
    s3Service = { upload: jest.fn().mockResolvedValue(undefined) };
    service = new ArticleImagesService(s3Service as never);
  });

  const SAFE_KEY = /^[\w.-]+$/;

  it('keeps a clean extension as-is', async () => {
    await service.upload(makeFile('screenshot.png'));
    const key = s3Service.upload.mock.calls[0][0] as string;
    expect(key.endsWith('.png')).toBe(true);
    expect(SAFE_KEY.test(key)).toBe(true);
  });

  it('falls back to .png for a filename with a "duplicate download" suffix, instead of producing an unreadable key', async () => {
    await service.upload(makeFile('screenshot.jpeg (1)'));
    const key = s3Service.upload.mock.calls[0][0] as string;
    expect(key.endsWith('.png')).toBe(true);
    expect(SAFE_KEY.test(key)).toBe(true);
  });

  it('falls back to .png for a filename with trailing whitespace in the extension', async () => {
    await service.upload(makeFile('photo.png '));
    const key = s3Service.upload.mock.calls[0][0] as string;
    expect(key.endsWith('.png')).toBe(true);
    expect(SAFE_KEY.test(key)).toBe(true);
  });

  it('still stores the real mimetype as S3 content type even when the key falls back to .png', async () => {
    await service.upload(makeFile('screenshot.jpeg (1)', { mimetype: 'image/jpeg' }));
    expect(s3Service.upload).toHaveBeenCalledWith(expect.any(String), expect.any(Buffer), 'image/jpeg');
  });

  it('falls back to .png for a filename with no extension at all', async () => {
    await service.upload(makeFile('screenshot'));
    const key = s3Service.upload.mock.calls[0][0] as string;
    expect(key.endsWith('.png')).toBe(true);
  });
});

// Regression coverage for the stored-XSS gap on this unauthenticated,
// unauthenticated-served endpoint: NestJS's FileTypeValidator only checks
// the SNIFFED magic-number type against the allowlist when sniffing
// succeeds, never cross-checking the client-declared mimetype in that case
// — so genuine image bytes declared as "text/html" used to pass validation
// and get served, with no Content-Disposition, to any anonymous FAQ
// visitor with that same lying declared type.
describe('ArticleImagesService.upload — stored Content-Type safety', () => {
  let s3Service: { upload: jest.Mock };
  let service: ArticleImagesService;

  beforeEach(() => {
    s3Service = { upload: jest.fn().mockResolvedValue(undefined) };
    service = new ArticleImagesService(s3Service as never);
  });

  it('never persists a declared mimetype outside the image allowlist', async () => {
    await service.upload(makeFile('evil.png', { mimetype: 'text/html' }));
    expect(s3Service.upload).toHaveBeenCalledWith(expect.any(String), expect.any(Buffer), 'application/octet-stream');
  });

  it('persists a genuinely allowed declared mimetype unchanged', async () => {
    await service.upload(makeFile('real.png', { mimetype: 'image/png' }));
    expect(s3Service.upload).toHaveBeenCalledWith(expect.any(String), expect.any(Buffer), 'image/png');
  });
});
