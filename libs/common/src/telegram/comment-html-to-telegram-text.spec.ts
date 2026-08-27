import { commentHtmlToTelegramText } from './comment-html-to-telegram-text.js';

describe('commentHtmlToTelegramText', () => {
  it('keeps existing paragraph-to-newline behavior unchanged', () => {
    const html = '<p>Первая строка</p><p>Вторая строка</p>';
    expect(commentHtmlToTelegramText(html)).toBe('Первая строка\nВторая строка');
  });

  it('degrades a table to a readable pipe-separated, one-row-per-line block', () => {
    const html =
      '<table><tbody><tr><th>Имя</th><th>Кол-во</th></tr><tr><td>Болты</td><td>5</td></tr></tbody></table>';
    expect(commentHtmlToTelegramText(html)).toBe('Имя | Кол-во\nБолты | 5');
  });
});
