import { zodResolver } from '@hookform/resolvers/zod';
import { Locale } from '@veloxdesk/types';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { AuthPreferencesBar } from '../components/common/AuthPreferencesBar.js';
import { LogoMark } from '../components/common/LogoMark.js';
import { CheckCircleIcon } from '../components/common/icons.js';
import { Spinner } from '../components/common/Spinner.js';
import { TurnstileWidget } from '../components/common/TurnstileWidget.js';
import { useRegister, useRegistrationStatus } from '../hooks/useAuth.js';
import { TURNSTILE_SITE_KEY } from '../lib/api/client.js';
import { getErrorMessage } from '../lib/errors.js';
import { useAuthStore } from '../store/auth.store.js';

type RegisterFormValues = { fullName: string; email: string; password: string };

type Step =
  | { kind: 'form' }
  | { kind: 'waiting'; userId: string }
  | { kind: 'approved' }
  | { kind: 'loginRequired' }
  | { kind: 'rejected' };

// Survives a refresh of the waiting screen — only ever a userId (see
// RegistrationStatusDto's comment on why that's an acceptable thing to
// persist), never the password.
const PENDING_REGISTRATION_KEY = 'veloxdesk-pending-registration';
// Just long enough for the checkmark to register before the redirect.
const APPROVED_REDIRECT_DELAY_MS = 1500;

export default function RegisterPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const registerAccount = useRegister();
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Forces a full unmount/remount of the widget (see TurnstileWidget's own
  // comment on why this is the reset mechanism) after a rejected submit —
  // a Turnstile token is single-use, so whatever the visitor solved is now
  // spent even though the widget may still show as "solved".
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [step, setStep] = useState<Step>(() => {
    const storedUserId = sessionStorage.getItem(PENDING_REGISTRATION_KEY);
    return storedUserId ? { kind: 'waiting', userId: storedUserId } : { kind: 'form' };
  });

  const status = useRegistrationStatus(step.kind === 'waiting' ? step.userId : null);

  useEffect(() => {
    const data = status.data;
    if (!data) return;

    if (data.approved) {
      sessionStorage.removeItem(PENDING_REGISTRATION_KEY);
      if ('requiresTwoFactor' in data) {
        // Same hand-off LoginPage already accepts from OidcCallbackPage —
        // this account has 2FA enabled, so the auto-login window can't hand
        // out tokens directly.
        navigate('/login', { replace: true, state: { challengeToken: data.challengeToken } });
      } else if ('requiresTwoFactorSetup' in data) {
        navigate('/login', { replace: true, state: { setupToken: data.setupToken } });
      } else if ('accessToken' in data) {
        setSession(data.accessToken, data.refreshToken, data.user);
        setStep({ kind: 'approved' });
      } else {
        setStep({ kind: 'loginRequired' });
      }
    } else if (data.rejected) {
      sessionStorage.removeItem(PENDING_REGISTRATION_KEY);
      setStep({ kind: 'rejected' });
    }
  }, [status.data, setSession, navigate]);

  useEffect(() => {
    if (step.kind !== 'approved') return;
    const timer = setTimeout(() => navigate('/tickets', { replace: true }), APPROVED_REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [step.kind, navigate]);

  // Rebuilt whenever the language changes so validation messages follow the
  // active locale — a plain module-level schema would freeze at whatever
  // language was active on first import.
  const registerSchema = useMemo(
    () =>
      z.object({
        fullName: z.string().min(1, t('auth.fullNameRequired')),
        email: z.string().email(t('auth.emailInvalid')),
        password: z.string().min(8, t('auth.passwordMinLength')),
      }),
    [t],
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = (values: RegisterFormValues) => {
    if (!captchaToken) return;
    registerAccount.mutate(
      // Whatever language the form was actually filled out in — safe to
      // seed unconditionally here (unlike login's syncPickedLocale), since
      // a brand-new account has no prior saved preference to clobber.
      { ...values, captchaToken, locale: i18n.language as Locale },
      {
        onSuccess: (data) => {
          sessionStorage.setItem(PENDING_REGISTRATION_KEY, data.userId);
          setStep({ kind: 'waiting', userId: data.userId });
        },
        onError: () => {
          // The submitted token is spent either way (Cloudflare invalidates
          // it on first verification attempt, success or failure) — force a
          // fresh widget rather than leaving a dead token behind a
          // still-"solved"-looking checkbox.
          setCaptchaToken(null);
          setCaptchaResetKey((k) => k + 1);
        },
      },
    );
  };

  const errorMessage = registerAccount.error ? getErrorMessage(registerAccount.error) : undefined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <AuthPreferencesBar />
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-start gap-1.5">
          <LogoMark size={40} />
          <div className="text-xs text-ink-subtle">
            {step.kind === 'form' ? t('auth.stepRegister') : t('auth.stepWaiting')}
          </div>
        </div>

        {step.kind === 'form' && (
          <>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
              <div>
                <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-ink-muted">
                  {t('auth.fullNameLabel')}
                </label>
                <input
                  id="fullName"
                  autoComplete="name"
                  className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
                  {...register('fullName')}
                />
                {errors.fullName && <p className="mt-1 text-xs text-priority-urgent">{errors.fullName.message}</p>}
              </div>

              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink-muted">
                  {t('auth.emailLabel')}
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
                  {...register('email')}
                />
                {errors.email && <p className="mt-1 text-xs text-priority-urgent">{errors.email.message}</p>}
              </div>

              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink-muted">
                  {t('auth.passwordLabel')}
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
                  {...register('password')}
                />
                {errors.password && <p className="mt-1 text-xs text-priority-urgent">{errors.password.message}</p>}
              </div>

              <div>
                <p className="mb-1 text-sm font-medium text-ink-muted">{t('auth.captchaLabel')}</p>
                <TurnstileWidget key={captchaResetKey} siteKey={TURNSTILE_SITE_KEY} onToken={setCaptchaToken} />
              </div>

              {errorMessage && (
                <p className="rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{errorMessage}</p>
              )}

              <button
                type="submit"
                disabled={registerAccount.isPending || !captchaToken}
                className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
              >
                {registerAccount.isPending ? t('auth.registering') : t('auth.registerLink')}
              </button>
            </form>

            <p className="mt-5 text-center text-[13px] text-ink-subtle">
              {t('auth.haveAccount')}{' '}
              <Link to="/login" className="font-medium text-brand-600 hover:underline">
                {t('auth.loginLink')}
              </Link>
            </p>
          </>
        )}

        {step.kind === 'waiting' && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <Spinner />
            <p className="text-sm text-ink-muted">{t('auth.waitingMessage')}</p>
          </div>
        )}

        {step.kind === 'approved' && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircleIcon className="h-12 w-12 text-status-resolved" />
            <p className="font-display text-base font-bold">{t('auth.approvedTitle')}</p>
          </div>
        )}

        {step.kind === 'loginRequired' && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircleIcon className="h-12 w-12 text-status-resolved" />
            <p className="font-display text-base font-bold">{t('auth.approvedTitle')}</p>
            <p className="text-sm text-ink-muted">{t('auth.loginRequiredMessage')}</p>
            <Link to="/login" className="font-medium text-brand-600 hover:underline">
              {t('auth.loginLink')}
            </Link>
          </div>
        )}

        {step.kind === 'rejected' && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <p className="font-display text-base font-bold text-priority-urgent">{t('auth.rejectedTitle')}</p>
            <p className="text-sm text-ink-muted">{t('auth.rejectedMessage')}</p>
            <Link to="/login" className="font-medium text-brand-600 hover:underline">
              {t('auth.backToLogin')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
