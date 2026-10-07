/**
 * Escapes characters with special meaning in SQL LIKE / ILIKE patterns (`%`, `_`, `\`).
 * Postgres uses `\` as the default escape character for pattern matching.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}
