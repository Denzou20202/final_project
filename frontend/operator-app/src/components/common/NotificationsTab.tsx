import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentUser } from '../../hooks/useAuth.js';
import { isPushSupported, requestNotificationPermission } from '../../lib/notify.js';
import { useNotificationPreferencesStore } from '../../store/notification-preferences.store.js';
import { Checkbox } from './Checkbox.js';

export function NotificationsTab() {
  const { t } = useTranslation();
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'admin';
  const soundEnabled = useNotificationPreferencesStore((s) => s.soundEnabled);
  const pushEnabled = useNotificationPreferencesStore((s) => s.pushEnabled);
  const setSoundEnabled = useNotificationPreferencesStore((s) => s.setSoundEnabled);
  const setPushEnabled = useNotificationPreferencesStore((s) => s.setPushEnabled);
  const [permissionDenied, setPermissionDenied] = useState(false);

  async function handlePushToggle(checked: boolean) {
    if (!checked) {
      setPushEnabled(false);
      return;
    }
    const granted = await requestNotificationPermission();
    if (granted) {
      setPermissionDenied(false);
      setPushEnabled(true);
    } else {
      setPermissionDenied(true);
      setPushEnabled(false);
    }
  }

  return (
    <div>
      <p className="mb-4 text-[12.5px] text-ink-subtle">
        {t('settings.notifications.description')}
        {isAdmin && ` ${t('settings.notifications.descriptionAdmin')}`}
      </p>

      <div className="flex flex-col gap-3">
        <label className="flex items-center justify-between gap-3 text-[13.5px]">
          <span>{t('settings.notifications.sound')}</span>
          <Checkbox checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} />
        </label>

        <label className="flex items-center justify-between gap-3 text-[13.5px]">
          <span>{t('settings.notifications.push')}</span>
          <Checkbox
            checked={pushEnabled}
            disabled={!isPushSupported()}
            onChange={(e) => void handlePushToggle(e.target.checked)}
          />
        </label>

        {!isPushSupported() && (
          <p className="text-[11.5px] text-ink-faint">{t('settings.notifications.pushUnsupported')}</p>
        )}
        {permissionDenied && (
          <p className="text-[11.5px] text-priority-urgent">{t('settings.notifications.pushDenied')}</p>
        )}
      </div>
    </div>
  );
}
