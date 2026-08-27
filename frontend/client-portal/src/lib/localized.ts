// Picks the current-locale variant of an admin-catalog name/title (ticket
// statuses, ticket categories) — falls back to the base (RU) value whenever
// the current locale's variant is null/undefined/empty. Own copy, not
// shared with operator-app — see labels.ts's own comment for why: the two
// apps share no frontend code by convention.
export function pickLocalized(
  base: string,
  uk: string | null | undefined,
  en: string | null | undefined,
  locale: string,
): string {
  if (locale === 'uk' && uk) return uk;
  if (locale === 'en' && en) return en;
  return base;
}
