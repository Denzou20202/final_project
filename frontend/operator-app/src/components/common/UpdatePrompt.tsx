import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';

// The browser only checks for a new service worker on its own when this tab
// navigates/reloads — a SPA left open for a whole shift (client-side routing
// never does a real navigation) can sit on a stale bundle indefinitely
// otherwise, silently missing every deploy since the tab was last opened.
// Poll explicitly so a deploy actually reaches a long-lived session.
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

// registerType: 'prompt' in vite.config.mts means the new service worker
// waits instead of activating itself — an operator mid-shift shouldn't have
// the app silently swap code under them. This banner is the only UI for
// picking up that update.
export function UpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        void registration.update();
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  if (!needRefresh) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex w-80 -translate-x-1/2 items-center justify-between gap-3 rounded-xl border border-border bg-elevated px-4 py-3 text-white shadow-lg">
      <span className="text-[13px]">{t('updatePrompt.available')}</span>
      <button
        type="button"
        onClick={() => updateServiceWorker(true)}
        className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-hover"
      >
        {t('updatePrompt.update')}
      </button>
    </div>
  );
}
