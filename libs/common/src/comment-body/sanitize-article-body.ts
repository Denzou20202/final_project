import sanitizeHtml from 'sanitize-html';

// Only local relative image endpoints served by the application
// (/api/public/images/ for KB/chat inline images, /api/attachments/ for
// ticket file attachments). Any external http/https image src is a potential
// tracking pixel (or IP-leak vector) and is downgraded to a safe <a> link
// instead of letting the browser silently fetch it.
const INTERNAL_IMG_SRC_RE = /^\/api\/(public\/images|attachments)\/[\w.-]+(\/download)?$/i;
const EXTERNAL_HTTP_HREF_RE = /^https?:\/\//i;

export function sanitizeArticleBody(html: string): string {
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
      'a',
      'img',
      'table',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt'],
      th: ['colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
    },
    allowedSchemesByTag: { img: [] },
    transformTags: {
      a: (_tagName, attribs): sanitizeHtml.Tag => {
        const href = attribs['href'] ?? '';
        if (!EXTERNAL_HTTP_HREF_RE.test(href) && !href.startsWith('/')) {
          return { tagName: 'span', attribs: {} };
        }
        return { tagName: 'a', attribs: { href, target: '_blank', rel: 'noopener noreferrer' } };
      },
      img: (_tagName, attribs): sanitizeHtml.Tag => {
        const src = attribs['src'] ?? '';
        if (INTERNAL_IMG_SRC_RE.test(src)) {
          return {
            tagName: 'img',
            attribs: {
              src,
              ...(attribs['alt'] ? { alt: attribs['alt'] } : {}),
            },
          };
        }
        if (EXTERNAL_HTTP_HREF_RE.test(src)) {
          return {
            tagName: 'a',
            attribs: { href: src, target: '_blank', rel: 'noopener noreferrer' },
            text: attribs['alt'] ? `[Изображение: ${attribs['alt']}]` : '[Внешнее изображение]',
          };
        }
        return { tagName: 'span', attribs: {} };
      },
    },
  });
}
