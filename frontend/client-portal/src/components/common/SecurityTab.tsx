import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useChangeOwnPassword, useCurrentUser } from '../../hooks/useAuth.js';
import { getErrorMessage } from '../../lib/errors.js';

// Password-change only — no 2FA self-toggle here (clients never get one;
// 2FA is org-mandated via their permission group's requireTwoFactor and
// forced at login, see LoginPage's mid-login setup flow). The TOTP field
// below is conditional on me.twoFactorEnabled purely because a client CAN
// already have 2FA enabled that way, even with no UI of their own to turn
// it on/off.
export function SecurityTab() {
  const { t } = useTranslation();
  const { data: me } = useCurrentUser();
  const changePassword = useChangeOwnPassword();

  const [isChanging, setChanging] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');

  function handleChangePassword() {
    if (!currentPassword || newPassword.length < 8 || !me) return;
    if (me.twoFactorEnabled && totpCode.length !== 6) return;
    changePassword.mutate(
      { currentPassword, newPassword, totpCode: me.twoFactorEnabled ? totpCode : undefined },
      {
        onSuccess: () => {
          setChanging(false);
          setCurrentPassword('');
          setNewPassword('');
          setTotpCode('');
        },
      },
    );
  }

  if (!me) return null;

  // Directory-provisioned/linked account (LDAP/OIDC) — there's no local
  // password for VeloxDesk to check, so the change-password flow doesn't
  // apply. No "convert back to local" escape hatch exists.
  if (me.authProvider !== 'local') {
    return (
      <div>
        <div className="mb-1 text-[13.5px] font-medium text-ink-muted">{t('settings.security.changePasswordTitle')}</div>
        <p className="text-[12.5px] text-ink-subtle">{t('settings.security.managedByDirectory')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13.5px] font-medium text-ink-muted">{t('settings.security.changePasswordTitle')}</div>
        <p className="text-[12.5px] text-ink-subtle">{t('settings.security.changePasswordDescription')}</p>
      </div>

      {!isChanging && (
        <button
          type="button"
          onClick={() => setChanging(true)}
          className="self-start rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-ink-muted hover:bg-surface-muted"
        >
          {t('settings.security.changePassword')}
        </button>
      )}

      {isChanging && (
        <div className="flex flex-col gap-2.5 rounded-lg border border-border p-3">
          <div>
            <label htmlFor="current-password" className="mb-1 block text-[12.5px] font-medium text-ink-muted">
              {t('settings.security.currentPassword')}
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
            />
          </div>
          <div>
            <label htmlFor="new-password" className="mb-1 block text-[12.5px] font-medium text-ink-muted">
              {t('settings.security.newPassword')}
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
            />
          </div>
          {me.twoFactorEnabled && (
            <div>
              <label htmlFor="totp-code" className="mb-1 block text-[12.5px] font-medium text-ink-muted">
                {t('settings.security.codeFromApp')}
              </label>
              <input
                id="totp-code"
                inputMode="numeric"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-center text-sm tracking-[0.3em] outline-none focus:border-brand-600"
                placeholder="000000"
              />
            </div>
          )}
          {changePassword.error && (
            <p className="text-[12px] text-priority-urgent">{getErrorMessage(changePassword.error)}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setChanging(false);
                setCurrentPassword('');
                setNewPassword('');
                setTotpCode('');
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-muted"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleChangePassword}
              disabled={
                changePassword.isPending ||
                !currentPassword ||
                newPassword.length < 8 ||
                (me.twoFactorEnabled && totpCode.length !== 6)
              }
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {changePassword.isPending ? t('settings.security.changingPassword') : t('settings.security.changePassword')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
