import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentUser } from './useAuth.js';

// The profile's `locale` is the source of truth once it's loaded (follows
// the person across devices/browsers) — this just keeps i18next's active
// language in sync with it. Mount once near the app root (AppLayout).
export function useSyncLocale(): void {
  const { data: me } = useCurrentUser();
  const { i18n } = useTranslation();

  useEffect(() => {
    if (me?.locale && me.locale !== i18n.language) {
      void i18n.changeLanguage(me.locale);
    }
  }, [me?.locale, i18n]);
}
