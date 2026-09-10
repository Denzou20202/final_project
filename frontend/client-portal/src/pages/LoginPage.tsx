import { zodResolver } from '@hookform/resolvers/zod';
import { AuthAudience, Locale } from '@veloxdesk/types';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { AuthPreferencesBar } from '../components/common/AuthPreferencesBar.js';
import { LogoMark } from '../components/common/LogoMark.js';
import { TurnstileWidget } from '../components/common/TurnstileWidget.js';
import {
  useAvailableAuthMethods,
  useConfirmTwoFactorRequired,
  useLogin,
  useSetupTwoFactorRequired,
  useVerifyTwoFactor,
} from '../hooks/useAuth.js';
import { TURNSTILE_SITE_KEY } from '../lib/api/client.js';
import { getErrorCode, getErrorMessage } from '../lib/errors.js';
import { useAuthStore } from '../store/auth.store.js';

type LoginFormValues = { email: string; password: string };

type Step =
  | { kind: 'credentials' }
  | { kind: 'challenge'; challengeToken: string }
  | { kind: 'setup'; setupToken: string; secret: string; otpauthUri: string };

function CodeForm({
  title,
  hint,
  onSubmit,
  onBack,
  isPending,
  errorMessage,
  children,
}: {
  title: string;
  hint: string;
  onSubmit: (code: string) => void;
  // Escape hatch back to the password step — without it, an expired
  // challenge/setup token (5 min TTL) leaves the user stuck on this screen
  // with nothing but an error until they reload the page.
  onBack: () => void;
  isPending: boolean;
  errorMessage: string | undefined;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  return (
    <div>
      <h2 className="mb-1 font-display text-base font-bold">{title}</h2>
      <p className="mb-4 text-[13px] text-ink-subtle">{hint}</p>
      {children}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(code);
        }}
        className="flex flex-col gap-4"
      >
        <div>
          <label htmlFor="totp-code" className="mb-1 block text-sm font-medium text-ink-muted">
            {t('auth.codeFromApp')}
          </label>
          <input
            id="totp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-center text-lg tracking-[0.3em] outline-none focus:border-brand-600"
            placeholder="000000"
          />
        </div>
        {errorMessage && (
          <p className="rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{errorMessage}</p>
        )}
        <button
          type="submit"
          disabled={isPending || code.length !== 6}
          className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
        >
          {isPending ? t('auth.verifying') : t('auth.confirm')}
        </button>
      </form>
      <p className="mt-4 text-center">
        <button type="button" onClick={onBack} className="text-[13px] font-medium text-brand-600 hover:underline">
          {t('auth.backToLogin')}
        </button>
      </p>
    </div>
  );
}

export default function LoginPage() {
  const { t } = useTranslation();
  const login = useLogin();
  const verifyTwoFactor = useVerifyTwoFactor();
  const setupTwoFactorRequired = useSetupTwoFactorRequired();
  const confirmTwoFactorRequired = useConfirmTwoFactorRequired();
  const navigate = useNavigate();
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.user?.role);

  // ?portal=staff is set by operator-app's ProtectedRoute/client.ts when it
  // bounces an unauthenticated staff member here — the only signal this
  // shared page has for which audience's LDAP/OIDC config applies (staff
  // and client can be configured completely differently, even point at
  // different IdP app registrations). Defaults to client, the public-facing
  // surface.
  const [searchParams] = useSearchParams();
  const audience = searchParams.get('portal') === 'staff' ? AuthAudience.STAFF : AuthAudience.CLIENT;
  const { data: authMethods } = useAvailableAuthMethods(audience);

  // Only ever appears after a first login attempt comes back tagged
  // CAPTCHA_REQUIRED (see AuthService.login) — most people never see this
  // at all. Sticky once shown for the rest of this page visit: the
  // triggering condition (the caller's IP over LoginLockoutService's
  // failure threshold) doesn't un-flag itself between one submit and the
  // next, so hiding it again after a wrong-password retry would just mean
  // showing it a third time anyway.
  const [requiresCaptcha, setRequiresCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // See RegisterPage's identical use of this pattern — forces a fresh
  // widget (a new, unspent token) after a rejected submit.
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const [step, setStep] = useState<Step>(() => {
    // OidcCallbackPage hands off a mid-login 2FA token this way when the
    // SSO-provisioned/linked account has TOTP enabled — the redirect-based
    // OIDC flow can't show this step itself, so it bounces back here.
    const navState = location.state as { challengeToken?: string; setupToken?: string } | null;
    if (navState?.challengeToken) return { kind: 'challenge', challengeToken: navState.challengeToken };
    return { kind: 'credentials' };
  });

  // The setup case needs a secret/otpauthUri to render the QR code, which
  // only setupTwoFactorRequired's mutation can fetch — the challenge case
  // above doesn't need this extra round trip, so it initializes `step`
  // directly instead.
  useEffect(() => {
    const navState = location.state as { setupToken?: string } | null;
    if (!navState?.setupToken) return;
    const setupToken = navState.setupToken;
    setupTwoFactorRequired.mutate(setupToken, {
      onSuccess: (setup) => setStep({ kind: 'setup', setupToken, secret: setup.secret, otpauthUri: setup.otpauthUri }),
    });
    // Deliberately empty deps — this handoff is a one-time consumption of
    // router state on mount, not something that should re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Set only when the person actually clicks a language on
  // AuthPreferencesBar — see useAuth.ts's syncPickedLocale for why the
  // ambient default (undefined here) must never trigger a profile sync.
  const [pickedLocale, setPickedLocale] = useState<Locale | undefined>(undefined);
  // Rebuilt whenever the language changes so validation messages follow the
  // active locale — a plain module-level schema would freeze at whatever
  // language was active on first import.
  const loginSchema = useMemo(
    () =>
      z.object({
        email: z.string().email(t('auth.emailInvalid')),
        password: z.string().min(1, t('auth.passwordRequired')),
      }),
    [t],
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  // Landing on /login with an existing session (e.g. a bookmark, or staff
  // bounced back here by operator-app's ProtectedRoute in some edge case)
  // shouldn't ask them to log in again — send them straight to their own
  // app. Staff crosses into the separate operator-app bundle via a real
  // navigation; a client stays in this same app via the router. This also
  // fires once verifyTwoFactor/confirmTwoFactorRequired set a session below.
  const isStaff = role === 'operator' || role === 'admin';
  useEffect(() => {
    if (!accessToken) return;
    // Same re-assignment-loop guard as ProtectedRoute/api/client.ts — see
    // ProtectedRoute.tsx's comment for why this matters even though the URL
    // looks unreachable from here in production.
    if (isStaff) {
      if (window.location.pathname !== '/staff/tickets') {
        window.location.href = '/staff/tickets';
      }
    } else {
      navigate('/tickets', { replace: true });
    }
  }, [accessToken, isStaff, navigate]);

  const onSubmit = (values: LoginFormValues) => {
    if (requiresCaptcha && !captchaToken) return;
    login.mutate(
      { ...values, locale: pickedLocale, audience, captchaToken: captchaToken ?? undefined },
      {
        onSuccess: (result) => {
          if ('requiresTwoFactor' in result) {
            setStep({ kind: 'challenge', challengeToken: result.challengeToken });
          } else if ('requiresTwoFactorSetup' in result) {
            setupTwoFactorRequired.mutate(result.setupToken, {
              onSuccess: (setup) =>
                setStep({ kind: 'setup', setupToken: result.setupToken, secret: setup.secret, otpauthUri: setup.otpauthUri }),
            });
          }
          // Plain AuthResponse — useLogin's own onSuccess already set the
          // session; the useEffect above picks it up and navigates.
        },
        onError: (error) => {
          if (getErrorCode(error) === 'CAPTCHA_REQUIRED') {
            setRequiresCaptcha(true);
          }
          // The submitted token (if any) is spent either way — force a
          // fresh widget rather than leaving a dead one behind a
          // still-"solved"-looking checkbox.
          setCaptchaToken(null);
          setCaptchaResetKey((k) => k + 1);
        },
      },
    );
  };

  if (accessToken) {
    return null;
  }

  const credentialsError = login.error ? getErrorMessage(login.error) : undefined;

  // Defaults to showing while the query is still loading (undefined) —
  // `local: true` is the overwhelmingly common case, and briefly rendering
  // the password form before it's confirmed beats a flash of nothing.
  const showPasswordForm = !authMethods || authMethods.local || authMethods.ldap.enabled;
  const showSsoButton = !!authMethods?.oidc.enabled && !!authMethods.oidc.loginUrl;
  // Self-registration always creates a local account (see AuthService
  // .register) — pointless (and rejected server-side) once local login is
  // disabled for this audience.
  const showRegisterLink = !authMethods || authMethods.local;

  function backToCredentials() {
    login.reset();
    verifyTwoFactor.reset();
    setupTwoFactorRequired.reset();
    confirmTwoFactorRequired.reset();
    setStep({ kind: 'credentials' });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <AuthPreferencesBar onLocaleChange={setPickedLocale} />
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-start gap-1.5">
          <LogoMark size={40} />
          <div className="text-xs text-ink-subtle">
            {step.kind === 'credentials'
              ? t('auth.stepLogin')
              : step.kind === 'challenge'
                ? t('auth.stepChallenge')
                : t('auth.stepSetup')}
          </div>
        </div>

        {step.kind === 'credentials' && (
          <>
            {showPasswordForm && (
              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
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
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
                    {...register('password')}
                  />
                  {errors.password && <p className="mt-1 text-xs text-priority-urgent">{errors.password.message}</p>}
                </div>

                {requiresCaptcha && (
                  <div>
                    <p className="mb-1 text-sm font-medium text-ink-muted">{t('auth.captchaLabel')}</p>
                    <TurnstileWidget key={captchaResetKey} siteKey={TURNSTILE_SITE_KEY} onToken={setCaptchaToken} />
                  </div>
                )}

                {credentialsError && (
                  <p className="rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{credentialsError}</p>
                )}

                <button
                  type="submit"
                  disabled={login.isPending || setupTwoFactorRequired.isPending || (requiresCaptcha && !captchaToken)}
                  className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
                >
                  {login.isPending || setupTwoFactorRequired.isPending ? t('auth.loggingIn') : t('auth.login')}
                </button>
              </form>
            )}

            {showSsoButton && (
              <a
                href={authMethods?.oidc.loginUrl}
                className={`flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-muted ${showPasswordForm ? 'mt-3' : ''}`}
              >
                {t('auth.ssoLogin')}
              </a>
            )}

            {showRegisterLink && (
              <p className="mt-5 text-center text-[13px] text-ink-subtle">
                {t('auth.noAccount')}{' '}
                <Link to="/register" className="font-medium text-brand-600 hover:underline">
                  {t('auth.registerLink')}
                </Link>
              </p>
            )}
            <p className="mt-2 text-center text-[13px] text-ink-subtle">
              <Link to="/faq" className="font-medium text-brand-600 hover:underline">
                {t('auth.helpLink')}
              </Link>
            </p>
          </>
        )}

        {step.kind === 'challenge' && (
          <CodeForm
            title={t('auth.twoFactorTitle')}
            hint={t('auth.twoFactorHint')}
            isPending={verifyTwoFactor.isPending}
            errorMessage={verifyTwoFactor.error ? getErrorMessage(verifyTwoFactor.error) : undefined}
            onSubmit={(token) => verifyTwoFactor.mutate({ challengeToken: step.challengeToken, token, locale: pickedLocale })}
            onBack={backToCredentials}
          />
        )}

        {step.kind === 'setup' && (
          <CodeForm
            title={t('auth.twoFactorSetupTitle')}
            hint={t('auth.twoFactorSetupHint')}
            isPending={confirmTwoFactorRequired.isPending}
            errorMessage={confirmTwoFactorRequired.error ? getErrorMessage(confirmTwoFactorRequired.error) : undefined}
            onSubmit={(token) =>
              confirmTwoFactorRequired.mutate({ setupToken: step.setupToken, secret: step.secret, token, locale: pickedLocale })
            }
            onBack={backToCredentials}
          >
            <div className="mb-4 flex flex-col items-center gap-2 rounded-lg border border-border-subtle bg-surface p-4">
              <QRCodeSVG value={step.otpauthUri} size={168} marginSize={2} />
              <p className="text-center text-[11px] text-ink-faint">
                {t('auth.scanHint')} <span className="font-mono">{step.secret}</span>
              </p>
            </div>
          </CodeForm>
        )}
      </div>
    </div>
  );
}
