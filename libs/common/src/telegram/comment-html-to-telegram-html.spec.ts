import { commentHtmlToTelegramHtml } from './comment-html-to-telegram-html.js';

describe('commentHtmlToTelegramHtml', () => {
  it('keeps existing bold/italic/paragraph behavior unchanged', () => {
    const html = '<p><strong>Важно</strong>: <em>проверьте</em> настройки</p>';
    expect(commentHtmlToTelegramHtml(html)).toBe('<b>Важно</b>: <i>проверьте</i> настройки');
  });

  it('degrades a table to a readable pipe-separated, one-row-per-line block', () => {
    const html =
      '<table><tbody><tr><th>Имя</th><th>Кол-во</th></tr><tr><td>Болты</td><td>5</td></tr></tbody></table>';
    expect(commentHtmlToTelegramHtml(html)).toBe('Имя | Кол-во\nБолты | 5');
  });

  it('renders text before and after a table around it, on their own lines', () => {
    const html = '<p>Вот отчёт:</p><table><tbody><tr><td>A</td><td>B</td></tr></tbody></table><p>Спасибо</p>';
    expect(commentHtmlToTelegramHtml(html)).toBe('Вот отчёт:\nA | B\nСпасибо');
  });
});
