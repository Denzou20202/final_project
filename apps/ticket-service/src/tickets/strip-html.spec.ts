import { stripHtml } from './strip-html.js';

describe('stripHtml', () => {
  it('keeps existing paragraph-to-newline behavior unchanged', () => {
    const html = '<p>Первая строка</p><p>Вторая строка</p>';
    expect(stripHtml(html)).toBe('Первая строка\nВторая строка');
  });

  it('degrades a table to a readable pipe-separated, one-row-per-line block', () => {
    const html =
      '<table><tbody><tr><th>Имя</th><th>Кол-во</th></tr><tr><td>Болты</td><td>5</td></tr></tbody></table>';
    expect(stripHtml(html)).toBe('Имя | Кол-во\nБолты | 5');
  });
});
