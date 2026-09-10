// Mirrors operator-app's identically-named helper (and the backend's
// telegram-ingestion.service.ts) — same three values as i18n.ts's
// supportedLngs, mapped to their Intl tag.
const LOCALE_TO_INTL: Record<string, string> = {
  ru: 'ru-RU',
  uk: 'uk-UA',
  en: 'en-US',
};

export function toIntlLocale(language: string): string {
  return LOCALE_TO_INTL[language] ?? LOCALE_TO_INTL['ru'];
}
