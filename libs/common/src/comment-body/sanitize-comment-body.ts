import sanitizeHtml from 'sanitize-html';

// A knowledge-base article reference (see ChatPanel's «База знаний» picker)
// gets this one special-cased shape — a bare root-relative path to
// client-portal's public FAQ route. Anchored full-string match: no query
// string, no fragment, no trailing garbage after the uuid.
const KB_ARTICLE_HREF_RE = /^\/faq\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Any absolute http(s) URL is allowed too (see transformTags.a below) —
// operators can link out to external docs/sites from a reply or macro, not
// just to an internal KB article. Everything else (javascript:,
// protocol-relative, a bare relative path, data:, a hand-crafted websocket
// payload) still downgrades to plain <span>, text kept, link dropped.
const EXTERNAL_HTTP_HREF_RE = /^https?:\/\//i;

// Comment bodies come from the frontends' Tiptap rich text editor
// (StarterKit + Underline, operator-app additionally has Mention, Image, and
// a Link mark; both apps now also have @tiptap/extension-table's TableKit)
// — this allowlist matches exactly what that editor can produce, nothing
// more. `span` is allowed ONLY for the mention node's data-* attributes (all
// inert — no href/src, so no javascript:/data: URI can sneak through
// there); every other plain tag gets no attributes at all.
//
// `a` is handled by transformTags rather than a plain allowedAttributes
// entry: sanitize-html re-applies allowedAttributes/naughtyHref to whatever
// transformTags returns, so returning a *fabricated* {href, target, rel}
// object here — never the caller's own target/rel, and only after the href
// passes KB_ARTICLE_HREF_RE or EXTERNAL_HTTP_HREF_RE — means the sanitizer
// never has to trust anything about the link except its href, and only for
// these two shapes.
//
// `img` mirrors sanitizeArticleBody's own allowance exactly (same
// allowedAttributes/allowedSchemesByTag) — chat/ticket comments used to keep
// images out of the body entirely (attachments were the only mechanism);
// that boundary was deliberately lifted so a macro (or a manual reply) can
// carry an inline screenshot the same way a KB article can.
//
// table/tbody/tr/th/td + colspan/rowspan mirror sanitizeArticleBody's own
// table shape exactly (see that file's comment for why style/colgroup/col
// are deliberately left out — both editors have table resizing disabled).
//
// Also reused by ticket-service for the ticket-creation description, which
// is now real Tiptap HTML too (NewTicketPage/CreateTicketModal both moved
// off a plain <textarea>), same safety boundary as any other comment body.
export function sanitizeCommentBody(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'code',
      'ul',
      'ol',
      'li',
      'blockquote',
      'span',
      'a',
      'img',
      'table',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    allowedAttributes: {
      span: ['data-type', 'data-id', 'data-label'],
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt'],
      th: ['colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
    },
    allowedSchemesByTag: { img: ['http', 'https'] },
    transformTags: {
      a: (_tagName, attribs): sanitizeHtml.Tag => {
        const href = attribs['href'] ?? '';
        if (!KB_ARTICLE_HREF_RE.test(href) && !EXTERNAL_HTTP_HREF_RE.test(href)) {
          return { tagName: 'span', attribs: {} };
        }
        return { tagName: 'a', attribs: { href, target: '_blank', rel: 'noopener noreferrer' } };
      },
    },
  });
}
