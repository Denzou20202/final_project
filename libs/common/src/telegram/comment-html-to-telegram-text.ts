import sanitizeHtml from 'sanitize-html';

// sanitizeCommentBody's output is HTML (Tiptap's <p>/<strong>/<a>/mention
// <span>s) — sending that literally as a Telegram sendMessage `text` would
// show raw tags to the client. Converts to plain text for the outbound
// relay in chat-service's postMessage(). Known, accepted limitation: a
// knowledge-base article <a href="/faq/...">Title</a> link degrades to
// just its link text — Telegram's plain sendMessage has no HTML mode
// wired up here, so the URL is dropped rather than sent broken.
export function commentHtmlToTelegramText(html: string): string {
  // Row/cell boundaries become real whitespace before the tag-strip below,
  // same reasoning as commentHtmlToTelegramHtml — otherwise a table's cells
  // run together with no separator at all.
  const withBreaks = html
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/t[hd]>/gi, ' | ')
    .replace(/<\/p>|<br\s*\/?>|<\/li>/gi, '\n');
  const plain = sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} });
  return plain
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/ \|\s*\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
