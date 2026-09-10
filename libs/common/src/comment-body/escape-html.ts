// Escapes plain text before it's stored as (or embedded in) a comment
// body/ticket description — for content that arrived as genuine plain text
// (not Tiptap-produced HTML) and must render as literal text, not be
// interpreted as markup. Without this, a plain-text string containing
// something like `<img src=x onerror="...">` — typed as ordinary
// characters by whoever sent it — would render as a real <img> tag once
// the frontend puts it into `dangerouslySetInnerHTML`.
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
