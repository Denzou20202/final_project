import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useChangeOwnPassword,
  useConfirmTwoFactor,
  useCurrentUser,
  useDisableTwoFactor,
  useSetupTwoFactor,
} from '../../hooks/useAuth.js';
import { getErrorMessage } from '../../lib/errors.js';

export function SecurityTab() {
  const { t } = useTranslation();
  const { data: me } = useCurrentUser();
  const setup = useSetupTwoFactor();
  const confirm = useConfirmTwoFactor();
  const disable = useDisableTwoFactor();
  const changePassword = useChangeOwnPassword();

  const [pending, setPending] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [confirmCode, setConfirmCode] = useState('');
  const [isDisabling, setDisabling] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');

  const [isChangingPassword, setChangingPassword] = useState(false);
  const [currentPasswordForChange, setCurrentPasswordForChange] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changeTotpCode, setChangeTotpCode] = useState('');

  function startSetup() {
    setup.mutate(undefined, { onSuccess: (data) => setPending(data) });
  }

  function handleConfirm() {
    if (!pending || confirmCode.length !== 6) return;
    confirm.mutate(
      { secret: pending.secret, token: confirmCode },
      {
        onSuccess: () => {
          setPending(null);
          setConfirmCode('');
        },
      },
    );
  }

  function handleDisable() {
    if (!disablePassword || disableCode.length !== 6) return;
    disable.mutate(
      { password: disablePassword, token: disableCode },
      {
        onSuccess: () => {
          setDisabling(false);
          setDisablePassword('');
          setDisableCode('');
        },
      },
    );
  }

  // POST /auth/change-password — any role, always self-targeting. Requires
  // the current password (and TOTP code, if 2FA is on): a valid session
  // alone is no longer enough to durably take over your own account this
  // way, regardless of who's asking.
  function handleChangePassword() {
    if (!currentPasswordForChange || newPassword.length < 8 || !me) return;
    if (me.twoFactorEnabled && changeTotpCode.length !== 6) return;
    changePassword.mutate(
      {
        currentPassword: currentPasswordForChange,
        newPassword,
        totpCode: me.twoFactorEnabled ? changeTotpCode : undefined,
      },
      {
        onSuccess: () => {
          setChangingPassword(false);
          setCurrentPasswordForChange('');
          setNewPassword('');
          setChangeTotpCode('');
        },
      },
    );
  }

  if (!me) return null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-sm font-medium">{t('settings.security.twoFactorTitle')}</div>
        <p className="text-[12.5px] text-ink-subtle">{t('settings.security.twoFactorDescription')}</p>
      </div>

      {me.twoFactorEnabled && !isDisabling && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-[13.5px] font-medium text-status-resolved">
            <span aria-hidden="true">●</span> {t('settings.security.enabled')}
          </span>
          <button
            type="button"
            onClick={() => setDisabling(true)}
            className="text-[12.5px] font-medium text-priority-urgent hover:underline"
          >
            {t('settings.security.disable')}
          </button>
        </div>
      )}

      {me.twoFactorEnabled && isDisabling && (
        <div className="flex flex-col gap-2.5 rounded-lg border border-border p-3">
          <div>
            <label htmlFor="disable-password" className="mb-1 block text-[12.5px] font-medium text-ink-muted">
              {t('settings.security.password')}
            </label>
            <input
              id="disable-password"
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
            />
          </div>
          <div>
            <label htmlFor="disable-code" className="mb-1 block text-[12.5px] font-medium text-ink-muted">
              {t('settings.security.codeFromApp')}
            </label>
            <input
              id="disable-code"
              inputMode="numeric"
              maxLength={6}
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-center text-sm tracking-[0.3em] outline-none focus:border-brand-600"
              placeholder="000000"
            />
          </div>
          {disable.error && <p className="text-[12px] text-priority-urgent">{getErrorMessage(disable.error)}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDisabling(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-muted"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleDisable}
              disabled={disable.isPending || !disablePassword || disableCode.length !== 6}
              className="rounded-lg bg-priority-urgent px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {disable.isPending ? t('settings.security.disabling') : t('settings.security.disable')}
            </button>
          </div>
        </div>
      )}

      {!me.twoFactorEnabled && !pending && (
        <div>
          <button
            type="button"
            onClick={startSetup}
            disabled={setup.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {setup.isPending ? t('settings.security.preparing') : t('settings.security.enable')}
          </button>
          {setup.error && <p className="mt-2 text-[12px] text-priority-urgent">{getErrorMessage(setup.error)}</p>}
        </div>
      )}

      {!me.twoFactorEnabled && pending && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <div className="flex flex-col items-center gap-2 rounded-lg border border-border-subtle bg-surface p-4">
            <QRCodeSVG value={pending.otpauthUri} size={160} marginSize={2} />
            <p className="text-center text-[11px] text-ink-faint">
              {t('settings.security.scanHint')} <span className="font-mono">{pending.secret}</span>
            </p>
          </div>
          <div>
            <label htmlFor="confirm-code" className="mb-1 block text-[12.5px] font-medium text-ink-muted">
              {t('settings.security.codeFromApp')}
            </label>
            <input
              id="confirm-code"
              inputMode="numeric"
              autoFocus
              maxLength={6}
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-center text-sm tracking-[0.3em] outline-none focus:border-brand-600"
              placeholder="000000"
            />
          </div>
          {confirm.error && <p className="text-[12px] text-priority-urgent">{getErrorMessage(confirm.error)}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPending(null);
                setConfirmCode('');
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-muted"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirm.isPending || confirmCode.length !== 6}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {confirm.isPending ? t('settings.security.confirming') : t('settings.security.confirm')}
            </button>
          </div>
        </div>
      )}

      {/* Shown to every role — POST /auth/change-password has no @Roles(),
          same as the 2FA setup/disable section above it. Directory-
          provisioned/linked accounts (LDAP/OIDC) have no local password to
          change here — 2FA above is unaffected, that's independent of
          authProvider. */}
      <div className="mt-2 border-t border-border pt-4">
          <div className="mb-1 text-sm font-medium">{t('settings.security.changePasswordTitle')}</div>

          {me.authProvider !== 'local' ? (
            <p className="text-[12.5px] text-ink-subtle">{t('settings.security.managedByDirectory')}</p>
          ) : (
            <>
          <p className="mb-3 text-[12.5px] text-ink-subtle">{t('settings.security.changePasswordDescription')}</p>

          {!isChangingPassword && (
            <button
              type="button"
              onClick={() => setChangingPassword(true)}
              className="rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-ink-muted hover:bg-surface-muted"
            >
              {t('settings.security.changePassword')}
            </button>
          )}

          {isChangingPassword && (
            <div className="flex flex-col gap-2.5 rounded-lg border border-border p-3">
              <div>
                <label htmlFor="change-current-password" className="mb-1 block text-[12.5px] font-medium text-ink-muted">
                  {t('settings.security.currentPassword')}
                </label>
                <input
                  id="change-current-password"
                  type="password"
                  value={currentPasswordForChange}
                  onChange={(e) => setCurrentPasswordForChange(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
                />
              </div>
              <div>
                <label htmlFor="change-new-password" className="mb-1 block text-[12.5px] font-medium text-ink-muted">
                  {t('settings.security.newPassword')}
                </label>
                <input
                  id="change-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
                />
              </div>
              {me.twoFactorEnabled && (
                <div>
                  <label htmlFor="change-totp-code" className="mb-1 block text-[12.5px] font-medium text-ink-muted">
                    {t('settings.security.codeFromApp')}
                  </label>
                  <input
                    id="change-totp-code"
                    inputMode="numeric"
                    maxLength={6}
                    value={changeTotpCode}
                    onChange={(e) => setChangeTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
                    setChangingPassword(false);
                    setCurrentPasswordForChange('');
                    setNewPassword('');
                    setChangeTotpCode('');
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
                    !currentPasswordForChange ||
                    newPassword.length < 8 ||
                    (me.twoFactorEnabled && changeTotpCode.length !== 6)
                  }
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
                >
                  {changePassword.isPending ? t('settings.security.changingPassword') : t('settings.security.changePassword')}
                </button>
              </div>
            </div>
          )}
            </>
          )}
      </div>
    </div>
  );
}
