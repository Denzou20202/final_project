import { Locale } from '@veloxdesk/types';
import { useTranslation } from 'react-i18next';
import { useCurrentUser, useUpdateOwnProfile } from '../../hooks/useAuth.js';

const LANGUAGES: Locale[] = [Locale.RU, Locale.UK, Locale.EN];

// Applies immediately (i18n.changeLanguage, no save step) and persists to
// the profile in the background — the person sees the effect right away
// instead of waiting on a round trip, but the choice still follows them to
// their next device/browser once it lands.
export function LanguageTab() {
  const { t, i18n } = useTranslation();
  const { data: me } = useCurrentUser();
  const updateProfile = useUpdateOwnProfile();

  function selectLanguage(locale: Locale) {
    void i18n.changeLanguage(locale);
    updateProfile.mutate({ locale });
  }

  const active = (i18n.language as Locale) ?? me?.locale ?? Locale.RU;

  return (
    <div>
      <p className="mb-4 text-[12.5px] text-ink-subtle">{t('settings.language.description')}</p>

      <div className="flex flex-col gap-2">
        {LANGUAGES.map((locale) => (
          <label
            key={locale}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-[13.5px] hover:bg-surface-muted"
          >
            <span>{t(`settings.language.${locale}`)}</span>
            <input
              type="radio"
              name="language"
              checked={active === locale}
              onChange={() => selectLanguage(locale)}
              className="h-4 w-4 accent-brand-600"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
