// Comment bodies are sanitized HTML (see chat-service's sanitizeCommentBody)
// from a small, known tag allowlist — good enough to unwrap into readable
// plain text for a downloadable transcript without a real HTML parser.
export function stripHtml(html: string): string {
  return html
    .replace(/<\/(p|li|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Row/cell boundaries become real whitespace before the generic tag
    // strip below — otherwise a table's cells run together with no
    // separator in the exported transcript.
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/t[hd]>/gi, ' | ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/ \|\s*\n/g, '\n')
    .trim();
}
