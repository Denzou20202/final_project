import sanitizeHtml from 'sanitize-html';

// Same source shape as commentHtmlToTelegramText (sanitizeCommentBody's
// Tiptap-produced HTML), but converts to the small HTML subset Telegram's
// sendMessage accepts under parse_mode: 'HTML' instead of stripping to
// plain text — bold/italic survive as real Telegram formatting, not just
// visually-lost markup. <a> is preserved too (KB-article links), with a
// relative /faq/... href absolutized since Telegram needs a real URL —
// sanitizeCommentBody only ever allows that one relative-path shape (see
// its own KB_ARTICLE_HREF_RE), so this is safe to assume, not a general
// URL rewrite.
const KB_LINK_BASE_URL = 'https://veloxdesk.pp.ua';

export function commentHtmlToTelegramHtml(html: string): string {
  const withBreaks = html
    // Telegram's HTML parse_mode has no <table> at all — sanitizeHtml below
    // would otherwise just strip every table/tr/td tag and run every cell's
    // text together with no separator. Row/cell boundaries become real
    // whitespace first so a table degrades to a readable "a | b" /
    // one-row-per-line block instead of a wall of concatenated text.
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/t[hd]>/gi, ' | ')
    .replace(/<\/p>|<br\s*\/?>|<\/li>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<strong>/gi, '<b>')
    .replace(/<\/strong>/gi, '</b>')
    .replace(/<em>/gi, '<i>')
    .replace(/<\/em>/gi, '</i>')
    .replace(/<a\s+href="(\/[^"]*)"[^>]*>/gi, (_match, href: string) => `<a href="${KB_LINK_BASE_URL}${href}">`);

  // Strips anything sanitizeCommentBody allowed that Telegram's HTML
  // parse_mode doesn't need forwarded (mention <span>s, ul/ol/li/blockquote
  // wrappers, table/tbody/tr/th/td) — sanitize-html re-serializes the
  // survivors as clean HTML, entities and all, so no manual escaping is
  // needed on top of this.
  const telegramHtml = sanitizeHtml(withBreaks, {
    allowedTags: ['b', 'i', 'u', 'code', 'a'],
    allowedAttributes: { a: ['href'] },
  });

  // Drops the trailing " | " a table's last cell in each row leaves before
  // its row-ending newline.
  return telegramHtml
    .replace(/ \|\s*\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
