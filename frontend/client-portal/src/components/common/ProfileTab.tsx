import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateTelegramLinkToken, useCurrentUser, useUpdateOwnProfile } from '../../hooks/useAuth.js';
import { getErrorMessage } from '../../lib/errors.js';
import { PHONE_REGEX, formatUaPhone } from '../../lib/textValidation.js';

function ReadOnlyField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="mb-1 text-[13.5px] font-medium text-ink-muted">{label}</div>
      <div className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-ink-subtle">
        {value || '—'}
      </div>
    </div>
  );
}

// Bot-side counterpart: TelegramIngestionService (ticket-service) — the
// generated link's /start <token> payload is what actually binds the chat.
// This component only ever mints the link; the bind itself happens in
// Telegram, out of band, which is why there's no live "connected!" update
// here — see useCreateTelegramLinkToken's comment.
function TelegramSection() {
  const { t } = useTranslation();
  const { data: me } = useCurrentUser();
  const createLink = useCreateTelegramLinkToken();

  return (
    <div className="border-t border-border pt-4">
      <div className="mb-1 text-[13.5px] font-medium text-ink-muted">{t('settings.profile.telegramLabel')}</div>

      {createLink.data ? (
        <div className="flex flex-col gap-2">
          <a
            href={createLink.data.link}
            target="_blank"
            rel="noreferrer"
            className="w-fit rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover"
          >
            {t('settings.profile.telegramOpenLink')}
          </a>
          <p className="text-[11.5px] text-ink-faint">{t('settings.profile.telegramLinkHint')}</p>
        </div>
      ) : (
        <>
          <p className="mb-2 text-sm text-ink-subtle">
            {me?.telegramLinked ? t('settings.profile.telegramLinked') : t('settings.profile.telegramNotLinked')}
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
                ? t('settings.profile.telegramRelinkButton')
                : t('settings.profile.telegramConnectButton')}
          </button>
        </>
      )}

      {createLink.isError && (
        <p className="mt-1 text-[12.5px] text-priority-urgent">{getErrorMessage(createLink.error)}</p>
      )}
    </div>
  );
}

// position/department/company/city are organizational context entered by an
// admin (or the mandatory onboarding form) — shown read-only so the client
// can see what support already has on file. computerName and phone are the
// two fields the person themselves actually knows and should be able to
// keep current (both shown to operators on the ticket's client-info panel,
// TicketActionsPanel.tsx in operator-app).
export function ProfileTab() {
  const { t } = useTranslation();
  const { data: me } = useCurrentUser();
  const updateProfile = useUpdateOwnProfile();
  const [computerName, setComputerName] = useState('');
  const [phone, setPhone] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setComputerName(me?.computerName ?? '');
    setPhone(me?.phone ?? '');
  }, [me?.computerName, me?.phone]);

  const phoneError = phone !== '' && !PHONE_REGEX.test(phone);
  // Once a value has been saved, the field can be updated but not cleared —
  // mirrors the guard in UsersService.updateOwnProfile so the user sees the
  // error before the round trip, not just after.
  const phoneClearError = phone === '' && !!me?.phone;
  const computerNameClearError = computerName === '' && !!me?.computerName;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phoneError || phoneClearError || computerNameClearError) return;
    setSaved(false);
    updateProfile.mutate({ computerName, phone }, { onSuccess: () => setSaved(true) });
  }

  const errorMessage = updateProfile.error ? getErrorMessage(updateProfile.error) : undefined;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <ReadOnlyField label={t('onboarding.positionLabel')} value={me?.position ?? null} />
        <ReadOnlyField label={t('onboarding.departmentLabel')} value={me?.department ?? null} />
        <ReadOnlyField label={t('onboarding.companyLabel')} value={me?.company ?? null} />
        <ReadOnlyField label={t('onboarding.cityLabel')} value={me?.city ?? null} />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 border-t border-border pt-4">
        <div>
          <label htmlFor="phone" className="mb-1 block text-[13.5px] font-medium text-ink-muted">
            {t('onboarding.phoneLabel')}
          </label>
          <input
            id="phone"
            type="tel"
            placeholder="+380 00 000-00-00"
            value={phone}
            onChange={(e) => {
              setPhone(formatUaPhone(e.target.value));
              setSaved(false);
            }}
            className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
          />
          {phoneError && <p className="mt-1 text-xs text-priority-urgent">{t('onboarding.phoneFormatError')}</p>}
          {!phoneError && phoneClearError && (
            <p className="mt-1 text-xs text-priority-urgent">{t('settings.profile.phoneClearError')}</p>
          )}
        </div>

        <div>
          <label htmlFor="computerName" className="mb-1 block text-[13.5px] font-medium text-ink-muted">
            {t('settings.profile.computerNameLabel')}
          </label>
          <input
            id="computerName"
            type="text"
            value={computerName}
            onChange={(e) => {
              setComputerName(e.target.value);
              setSaved(false);
            }}
            placeholder={t('settings.profile.computerNamePlaceholder')}
            // Matches @MaxLength(255) in update-own-profile.dto.ts — without
            // it, pasting a longer string was silently accepted client-side
            // and only rejected on submit with a raw, unmapped
            // class-validator message instead of a friendly hint.
            // maxLength truncates pasted text too, not just typed input.
            maxLength={255}
            className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
          />
          {computerNameClearError ? (
            <p className="mt-1 text-[11.5px] text-priority-urgent">{t('settings.profile.computerNameClearError')}</p>
          ) : (
            <p className="mt-1 text-[11.5px] text-ink-faint">{t('settings.profile.computerNameHint')}</p>
          )}
        </div>

        {errorMessage && <p className="text-[12.5px] text-priority-urgent">{errorMessage}</p>}
        {saved && !updateProfile.isPending && <p className="text-[12.5px] text-brand-700">{t('common.saved')}</p>}

        <button
          type="submit"
          disabled={updateProfile.isPending || phoneError || phoneClearError || computerNameClearError}
          className="self-start rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
        >
          {updateProfile.isPending ? t('common.saving') : t('common.save')}
        </button>
      </form>

      <TelegramSection />
    </div>
  );
}
