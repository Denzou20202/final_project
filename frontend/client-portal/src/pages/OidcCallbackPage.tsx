import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { fetchMe } from '../lib/api/users.api.js';
import { getErrorMessage } from '../lib/errors.js';
import { useAuthStore } from '../store/auth.store.js';

// Landing point for BOTH the client and staff OIDC flows (see
// oidc-auth.controller.ts's callback — it always redirects here, to THIS
// app's bundle, then this page hard-navigates into /staff/ if the resolved
// user turns out to be staff, mirroring how LoginPage's own post-login
// redirect already crosses that same app boundary). Tokens travel in the
// URL FRAGMENT, never the query string — fragments never reach nginx/access
// logs, only page JS can read them.
export default function OidcCallbackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);
  // StrictMode/dev double-invokes effects — this guards against firing the
  // token exchange (and the resulting session-wide side effects) twice.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const fragment = new URLSearchParams(window.location.hash.slice(1));
    // Never let the tokens sit in the visible URL/browser history longer
    // than the instant it takes to read them.
    window.history.replaceState(null, '', window.location.pathname);

    const fragmentError = fragment.get('error');
    if (fragmentError) {
      setError(fragmentError);
      return;
    }

    const twoFactor = fragment.get('twoFactor');
    if (twoFactor === 'challenge') {
      const challengeToken = fragment.get('challengeToken');
      if (challengeToken) {
        navigate('/login', { replace: true, state: { challengeToken } });
        return;
      }
    }
    if (twoFactor === 'setup') {
      const setupToken = fragment.get('setupToken');
      if (setupToken) {
        navigate('/login', { replace: true, state: { setupToken } });
        return;
      }
    }

    const accessToken = fragment.get('accessToken');
    const refreshToken = fragment.get('refreshToken');
    if (!accessToken || !refreshToken) {
      setError(t('auth.ssoGenericError'));
      return;
    }

    (async () => {
      try {
        // fetchMe needs a token to authenticate with, but setSession needs
        // the full PublicUser it's about to fetch — set the token alone
        // first (bypassing the typed setSession action), then finalize with
        // the real user once known.
        useAuthStore.setState({ accessToken, refreshToken });
        const user = await fetchMe();
        setSession(accessToken, refreshToken, user);
        if (user.role === 'operator' || user.role === 'admin') {
          window.location.href = '/staff/tickets';
        } else {
          navigate('/tickets', { replace: true });
        }
      } catch (err) {
        useAuthStore.getState().clear();
        setError(getErrorMessage(err));
      }
    })();
  }, [navigate, setSession, t]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface-card p-8 text-center shadow-sm">
        {error ? (
          <>
            <p className="mb-4 text-sm text-priority-urgent">{error}</p>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              {t('auth.backToLogin')}
            </button>
          </>
        ) : (
          <p className="text-sm text-ink-subtle">{t('auth.ssoCompleting')}</p>
        )}
      </div>
    </div>
  );
}
