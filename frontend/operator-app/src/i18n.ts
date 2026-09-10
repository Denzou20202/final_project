import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ru from './locales/ru.json';
import uk from './locales/uk.json';

// Language starts from whatever the browser/last visit suggests (nobody's
// logged in yet, so there's no profile to read) — useSyncLocale (in
// hooks/useSyncLocale.ts) takes over once useCurrentUser() resolves and
// makes the profile's `locale` authoritative from then on, including
// across devices.
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
      uk: { translation: uk },
      en: { translation: en },
    },
    fallbackLng: 'ru',
    supportedLngs: ['ru', 'uk', 'en'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'veloxdesk-language',
    },
  });

export default i18n;
