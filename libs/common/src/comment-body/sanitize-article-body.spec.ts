import { sanitizeArticleBody } from './sanitize-article-body.js';

describe('sanitizeArticleBody', () => {
  it('allows an img with an internal relative path (/api/public/images/...)', () => {
    const html = '<p><img src="/api/public/images/screenshot-123.png" alt="скрин"></p>';
    expect(sanitizeArticleBody(html)).toBe('<p><img src="/api/public/images/screenshot-123.png" alt="скрин" /></p>');
  });

  it('neutralizes an external http(s) img into a safe link to prevent tracking pixels', () => {
    const html = '<p><img src="https://example.com/pixel.png" alt="трекер"></p>';
    expect(sanitizeArticleBody(html)).toBe(
      '<p><a href="https://example.com/pixel.png" target="_blank" rel="noopener noreferrer">[Изображение: трекер]</a></p>',
    );
  });

  it('neutralizes an external http(s) img without alt into placeholder link', () => {
    const html = '<p><img src="http://example.com/banner.jpg"></p>';
    expect(sanitizeArticleBody(html)).toBe(
      '<p><a href="http://example.com/banner.jpg" target="_blank" rel="noopener noreferrer">[Внешнее изображение]</a></p>',
    );
  });

  it('strips a data: src or javascript: src off an img to prevent payload injection', () => {
    const html = '<p><img src="data:image/png;base64,AAAA" alt="bad"></p>';
    expect(sanitizeArticleBody(html)).toBe('<p></p>');
  });

  it('allows tables with colspan/rowspan and clean elements', () => {
    const html = '<table><tbody><tr><th>Заголовок</th></tr><tr><td colspan="2">Данные</td></tr></tbody></table>';
    expect(sanitizeArticleBody(html)).toBe(html);
  });
});
