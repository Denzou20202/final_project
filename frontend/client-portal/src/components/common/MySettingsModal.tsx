import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloseIcon } from './icons.js';
import { LanguageTab } from './LanguageTab.js';
import { NotificationsTab } from './NotificationsTab.js';
import { ProfileTab } from './ProfileTab.js';
import { SecurityTab } from './SecurityTab.js';
import { DesignTab } from './DesignTab.js';

type Tab = 'notifications' | 'profile' | 'security' | 'language' | 'design';

export function MySettingsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [active, setActive] = useState<Tab>('notifications');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'notifications', label: t('settings.tabNotifications') },
    { key: 'profile', label: t('settings.tabProfile') },
    { key: 'security', label: t('settings.tabSecurity') },
    { key: 'design', label: t('settings.tabDesign') },
    { key: 'language', label: t('settings.tabLanguage') },
  ];

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-surface-card shadow-lg sm:h-[70vh] sm:max-w-2xl sm:flex-row sm:rounded-2xl sm:border sm:border-border">
        <aside className="flex flex-none gap-1 overflow-x-auto border-b border-border bg-surface-sidebar p-2 sm:w-48 sm:flex-col sm:gap-0.5 sm:overflow-visible sm:border-b-0 sm:border-r sm:p-0 sm:py-4">
          <div className="mb-2 hidden px-4 text-[11px] font-bold uppercase tracking-wider text-ink-faint sm:block">
            {t('settings.title')}
          </div>
          <nav className="flex flex-none flex-row gap-1 px-1 sm:flex-col sm:gap-0.5 sm:px-2.5">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActive(tab.key)}
                className={`whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors ${
                  active === tab.key
                    ? 'bg-brand-50 font-semibold text-brand-700'
                    : 'text-ink-muted hover:bg-surface-card'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex flex-none items-center justify-end border-b border-border px-3 py-2">
            <button
              type="button"
              onClick={onClose}
              title={t('common.close')}
              aria-label={t('common.close')}
              className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-muted hover:text-priority-urgent"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            {active === 'notifications' && <NotificationsTab />}
            {active === 'profile' && <ProfileTab />}
            {active === 'security' && <SecurityTab />}
            {active === 'design' && <DesignTab />}
            {active === 'language' && <LanguageTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
