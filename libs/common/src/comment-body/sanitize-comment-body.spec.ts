import { sanitizeCommentBody } from './sanitize-comment-body.js';

describe('sanitizeCommentBody', () => {
  const ARTICLE_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

  it('keeps a valid knowledge-base article link and forces its own target/rel', () => {
    const html = `<p><a href="/faq/${ARTICLE_ID}" target="_self" rel="whatever">Как настроить принтер</a></p>`;
    expect(sanitizeCommentBody(html)).toBe(
      `<p><a href="/faq/${ARTICLE_ID}" target="_blank" rel="noopener noreferrer">Как настроить принтер</a></p>`,
    );
  });

  it('keeps an external https URL, forcing its own target/rel', () => {
    const html = '<p><a href="https://example.com/docs" target="_self" rel="whatever">click me</a></p>';
    expect(sanitizeCommentBody(html)).toBe(
      '<p><a href="https://example.com/docs" target="_blank" rel="noopener noreferrer">click me</a></p>',
    );
  });

  it('keeps an external http URL', () => {
    const html = '<p><a href="http://example.com">click me</a></p>';
    expect(sanitizeCommentBody(html)).toBe(
      '<p><a href="http://example.com" target="_blank" rel="noopener noreferrer">click me</a></p>',
    );
  });

  it('downgrades a bare relative href that is not the KB-article shape', () => {
    const html = '<p><a href="/some/other/path">link</a></p>';
    expect(sanitizeCommentBody(html)).toBe('<p><span>link</span></p>');
  });

  it('downgrades a javascript: href', () => {
    const html = '<p><a href="javascript:alert(1)">link</a></p>';
    expect(sanitizeCommentBody(html)).toBe('<p><span>link</span></p>');
  });

  it('downgrades a malformed article id', () => {
    const html = '<p><a href="/faq/not-a-uuid">link</a></p>';
    expect(sanitizeCommentBody(html)).toBe('<p><span>link</span></p>');
  });

  it('downgrades a well-formed href with trailing garbage after the uuid', () => {
    const html = `<p><a href="/faq/${ARTICLE_ID}/../../admin">link</a></p>`;
    expect(sanitizeCommentBody(html)).toBe('<p><span>link</span></p>');
  });

  it('downgrades a protocol-relative href disguised as a path', () => {
    const html = '<p><a href="//evil.example">link</a></p>';
    expect(sanitizeCommentBody(html)).toBe('<p><span>link</span></p>');
  });

  it('drops an anchor with no href at all', () => {
    const html = '<p><a>link</a></p>';
    expect(sanitizeCommentBody(html)).toBe('<p><span>link</span></p>');
  });

  it('still allows the existing mention span untouched', () => {
    const html = '<p>Hey <span data-type="mention" data-id="u1" data-label="Иван">@Иван</span></p>';
    expect(sanitizeCommentBody(html)).toBe(html);
  });

  it('still strips a tag outside the allowlist', () => {
    const html = '<p>hi<script>alert(1)</script></p>';
    expect(sanitizeCommentBody(html)).toBe('<p>hi</p>');
  });

  it('passes plain text through unchanged', () => {
    const text = 'Оформил заказ №1234, письмо не пришло';
    expect(sanitizeCommentBody(text)).toBe(text);
  });

  it('allows a table with colspan/rowspan, same shape as sanitizeArticleBody', () => {
    const html =
      '<table><tbody><tr><th>Имя</th><th>Кол-во</th></tr><tr><td colspan="2">Итого: 5</td></tr></tbody></table>';
    expect(sanitizeCommentBody(html)).toBe(html);
  });

  it('strips a style attribute off a table cell', () => {
    const html = '<table><tbody><tr><td style="width:200px">x</td></tr></tbody></table>';
    expect(sanitizeCommentBody(html)).toBe('<table><tbody><tr><td>x</td></tr></tbody></table>');
  });

  it('allows an img with an internal relative path (/api/public/images/...)', () => {
    const html = '<p><img src="/api/public/images/screenshot-123.png" alt="скрин"></p>';
    expect(sanitizeCommentBody(html)).toBe('<p><img src="/api/public/images/screenshot-123.png" alt="скрин" /></p>');
  });

  it('allows an img with an internal attachment path (/api/attachments/...)', () => {
    const html = '<p><img src="/api/attachments/3fa85f64-5717-4562-b3fc-2c963f66afa6" alt="вложение"></p>';
    expect(sanitizeCommentBody(html)).toBe('<p><img src="/api/attachments/3fa85f64-5717-4562-b3fc-2c963f66afa6" alt="вложение" /></p>');
  });

  it('neutralizes an external http(s) img into a safe link to prevent tracking pixels', () => {
    const html = '<p><img src="https://example.com/pixel.png" alt="трекер"></p>';
    expect(sanitizeCommentBody(html)).toBe(
      '<p><a href="https://example.com/pixel.png" target="_blank" rel="noopener noreferrer">[Изображение: трекер]</a></p>',
    );
  });

  it('strips a data: src off an img to prevent payload injection', () => {
    const html = '<p><img src="data:image/png;base64,aaaa" alt="x"></p>';
    expect(sanitizeCommentBody(html)).toBe('<p><span></span></p>');
  });

  it('strips a javascript: src off an img', () => {
    const html = '<p><img src="javascript:alert(1)" alt="x"></p>';
    expect(sanitizeCommentBody(html)).toBe('<p><span></span></p>');
  });
});
