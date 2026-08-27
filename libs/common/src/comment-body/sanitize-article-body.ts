import sanitizeHtml from 'sanitize-html';

// Same allowlist as sanitizeCommentBody (which also allows the table tag
// set below — see that function's own comment), plus <img> for pasted
// screenshots — kept as a SEPARATE function rather than widening
// sanitizeCommentBody itself: chat/ticket comments deliberately keep images
// out of the text body (attachments are their own linked mechanism, see
// AttachmentEntity), while knowledge-base articles embed pasted screenshots
// inline via Tiptap's Image extension. allowedSchemesByTag blocks a
// javascript:/data: src from sneaking in as an img source.
//
// Table shape is Tiptap's exact renderHTML output (@tiptap/extension-table,
// verified against its dist source): `<table style="..."><colgroup>...
// </colgroup><tbody><tr><td colspan rowspan>...</td></tr></tbody></table>`
// — no <thead>, header cells are plain <th> rows inside the same <tbody>.
// `style`/`colgroup`/`col` are deliberately NOT allowed: they only ever
// carry Tiptap's auto column-width styling (this editor has resizing
// disabled, so nothing meaningful would survive anyway) — dropping them
// leaves a clean `<table><tbody><tr>...</tr></tbody></table>` and layout is
// handled by the reader's own CSS instead. colspan/rowspan ARE kept so a
// merged cell (Tiptap's default table selection/merge behavior, reachable
// without a dedicated toolbar button) round-trips correctly.
export function sanitizeArticleBody(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'code', 'ul', 'ol', 'li', 'blockquote', 'img', 'table', 'tbody', 'tr', 'th', 'td'],
    allowedAttributes: { img: ['src', 'alt'], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'] },
    allowedSchemesByTag: { img: ['http', 'https'] },
  });
}
