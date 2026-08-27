import { useTranslation } from 'react-i18next';
import { useCreateTelegramLinkToken, useCurrentUser } from '../../hooks/useAuth.js';
import { getErrorMessage } from '../../lib/errors.js';

// «Мои настройки → Telegram» — mirrors client-portal's ProfileTab
// TelegramSection almost exactly (same backend endpoint, role-agnostic).
// For an admin, linking also opts them into TelegramAdminNotifyService's
// registration-approval pings (see that service) — the description below
// is the one piece that differs from the client-facing copy.
export function TelegramTab() {
  const { t } = useTranslation();
  const { data: me } = useCurrentUser();
  const createLink = useCreateTelegramLinkToken();

  return (
    <div>
      <p className="mb-4 text-[12.5px] text-ink-subtle">{t('settings.telegram.description')}</p>

      {createLink.data ? (
        <div className="flex flex-col gap-2">
          <a
            href={createLink.data.link}
            target="_blank"
            rel="noreferrer"
            className="w-fit rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover"
          >
            {t('settings.telegram.openLink')}
          </a>
          <p className="text-[11.5px] text-ink-faint">{t('settings.telegram.linkHint')}</p>
        </div>
      ) : (
        <>
          <p className="mb-2 text-[13.5px] text-ink-subtle">
            {me?.telegramLinked ? t('settings.telegram.linked') : t('settings.telegram.notLinked')}
          </p>
          <button
            type="button"
            onClick={() => createLink.mutate()}
            disabled={createLink.isPending}
            className="self-start rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-ink-muted hover:bg-surface-muted disabled:opacity-60"
          >
            {createLink.isPending
              ? t('common.saving')
              : me?.telegramLinked
                ? t('settings.telegram.relinkButton')
                : t('settings.telegram.connectButton')}
          </button>
        </>
      )}

      {createLink.isError && (
        <p className="mt-2 text-[12.5px] text-priority-urgent">{getErrorMessage(createLink.error)}</p>
      )}
    </div>
  );
}
