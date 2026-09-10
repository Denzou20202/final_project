// Picks the current-locale variant of an admin-catalog name/title/label
// (ticket statuses, custom fields, macros, articles, teams, tags,
// categories, employee statuses) — falls back to the base (RU) value
// whenever the current locale's variant is null/undefined/empty. Covers
// both "never translated" (rows created before this feature, or DeepL
// returned null and the admin left it blank) and the 4 seeded ticket
// statuses (which have no nameUk/nameEn at all — StatusBadge/Sidebar
// already route those through the `key`-based i18next lookup first and
// only reach this as their own fallback).
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
