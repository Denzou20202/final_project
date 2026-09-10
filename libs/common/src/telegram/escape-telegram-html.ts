// Escapes plain text (NOT already-HTML content — see commentHtmlToTelegramHtml
// for that) for safe inclusion in a sendMessage call using parse_mode:
// 'HTML'. Needed whenever a message mixes raw, unsanitized text (a ticket
// title, a user's full name) with parse_mode: 'HTML' — Telegram parses the
// ENTIRE message as HTML in that mode, so an unescaped `<`/`&` in the raw
// part would either break parsing or be misread as markup, same risk
// commentHtmlToTelegramText's own comment calls out for the plain-text path.
export function escapeTelegramHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
