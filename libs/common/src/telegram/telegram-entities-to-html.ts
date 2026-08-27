export interface TelegramMessageEntity {
  type: string;
  offset: number;
  length: number;
}

// Telegram never sends inline markup in `text` — formatting arrives as a
// separate `entities` array of (type, offset, length) spans over the plain
// string. Converts those spans into the HTML tags sanitizeCommentBody
// already accepts (<strong>/<em>/<u>), so a client's bold/italic/underline
// survives into the ticket the same way it would if typed in ChatPanel's
// Tiptap editor. Offsets are UTF-16 code units, same as JS string
// indexing, so plain slicing lines up correctly for all but exotic
// surrogate-pair edge cases (emoji-heavy text) — an accepted v1 gap.
const ENTITY_TAG: Partial<Record<string, string>> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  code: 'code',
};

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function telegramEntitiesToHtml(text: string, entities: TelegramMessageEntity[] | undefined): string {
  if (!entities?.length) {
    return escapeHtml(text);
  }

  interface Boundary {
    pos: number;
    isStart: boolean;
    tag: string;
  }
  const boundaries: Boundary[] = [];
  for (const entity of entities) {
    const tag = ENTITY_TAG[entity.type];
    if (!tag) continue; // unsupported entity types (mentions, text_link, spoiler, …) — left as plain text
    boundaries.push({ pos: entity.offset, isStart: true, tag });
    boundaries.push({ pos: entity.offset + entity.length, isStart: false, tag });
  }
  if (boundaries.length === 0) {
    return escapeHtml(text);
  }
  // Closes before opens at the same position, so adjacent (non-overlapping)
  // spans nest cleanly instead of interleaving.
  boundaries.sort((a, b) => a.pos - b.pos || Number(a.isStart) - Number(b.isStart));

  let result = '';
  let cursor = 0;
  const openStack: string[] = [];
  for (const b of boundaries) {
    if (b.pos > cursor) {
      result += escapeHtml(text.slice(cursor, b.pos));
      cursor = b.pos;
    }
    if (b.isStart) {
      result += `<${b.tag}>`;
      openStack.push(b.tag);
      continue;
    }
    // Close (possibly overlapping spans, e.g. bold+italic covering
    // different ranges): close everything opened after this tag too, then
    // reopen those on the other side of this tag's close, so the output
    // stays properly nested even though Telegram's entities don't have to
    // be.
    const idx = openStack.lastIndexOf(b.tag);
    if (idx === -1) continue;
    const above = openStack.splice(idx);
    for (let i = above.length - 1; i >= 0; i--) result += `</${above[i]}>`;
    above.shift();
    for (const tag of above) result += `<${tag}>`;
    openStack.push(...above);
  }
  if (cursor < text.length) {
    result += escapeHtml(text.slice(cursor));
  }
  for (let i = openStack.length - 1; i >= 0; i--) {
    result += `</${openStack[i]}>`;
  }
  return result;
}
