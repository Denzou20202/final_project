import { Locale } from '@veloxdesk/types';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../../store/theme.store.js';
import { MoonIcon, SunIcon } from './icons.js';

const LANGUAGES: Locale[] = [Locale.RU, Locale.UK, Locale.EN];

// Lets a person pick a language/theme before they're authenticated — on
// Login and Register, where Sidebar/MySettingsModal (the usual home for
// these two controls) don't exist yet. Theme applies immediately via the
// module-level side effect in theme.store.ts and needs nothing else — it's
// pure localStorage, not tied to any account. Language applies immediately
// too (i18next-browser-languagedetector caches it in localStorage), but
// `onLocaleChange` additionally tells the page a person explicitly picked
// one, as opposed to it merely being the ambient browser/localStorage
// default — see useAuth.ts's syncPickedLocale for why that distinction
// matters.
export function AuthPreferencesBar({ onLocaleChange }: { onLocaleChange?: (locale: Locale) => void }) {
  const { t, i18n } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const active = i18n.language as Locale;

  function selectLocale(locale: Locale) {
    void i18n.changeLanguage(locale);
    onLocaleChange?.(locale);
  }

  return (
    <div className="fixed right-4 top-4 z-10 flex items-center gap-2">
      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-card p-0.5">
        {LANGUAGES.map((locale) => (
          <button
            key={locale}
            type="button"
            onClick={() => selectLocale(locale)}
            title={t(`settings.language.${locale}`)}
            aria-label={t(`settings.language.${locale}`)}
            aria-pressed={active === locale}
            className={`rounded-md px-2 py-1 text-[12px] font-semibold uppercase transition-colors ${
              active === locale ? 'bg-brand-600 text-white' : 'text-ink-subtle hover:text-brand-600'
            }`}
          >
            {locale}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={toggleTheme}
        title={theme === 'dark' ? t('sidebar.lightTheme') : t('sidebar.darkTheme')}
        aria-label={theme === 'dark' ? t('sidebar.lightTheme') : t('sidebar.darkTheme')}
        className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg border border-border bg-surface-card text-ink-subtle transition-colors hover:text-brand-600"
      >
        {theme === 'dark' ? <SunIcon className="h-[17px] w-[17px]" /> : <MoonIcon className="h-[17px] w-[17px]" />}
      </button>
    </div>
  );
}
