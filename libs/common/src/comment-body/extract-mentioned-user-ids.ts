const MENTION_SPAN_RE = /<span\b[^>]*>/gi;
const IS_MENTION_RE = /data-type="mention"/i;
const DATA_ID_RE = /data-id="([0-9a-f-]{36})"/i;

// Pulls mentioned user ids out of an already-sanitized comment body (see
// sanitizeCommentBody's span[data-type,data-id] allowlist — the Mention
// extension's default renderHTML output). Restricting the match to a
// UUID-shaped data-id is defense in depth on top of sanitize-html's own
// escaping: only well-formed ids ever reach a notification enqueue.
export function extractMentionedUserIds(html: string): string[] {
  const ids = new Set<string>();
  for (const match of html.matchAll(MENTION_SPAN_RE)) {
    const tag = match[0];
    if (!IS_MENTION_RE.test(tag)) continue;
    const idMatch = DATA_ID_RE.exec(tag);
    if (idMatch) ids.add(idMatch[1]);
  }
  return [...ids];
}
