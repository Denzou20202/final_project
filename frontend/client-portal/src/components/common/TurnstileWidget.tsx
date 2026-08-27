import { useEffect, useRef, useState } from 'react';

// Cloudflare's own script attaches this to the global scope — narrow typing
// for just the two methods this component actually calls.
declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
    };
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
// Module-level, not per-component-instance — Register and Login can both
// mount a widget in the same session (rare, but e.g. two tabs), and the
// script tag must only ever be injected once regardless.
let scriptLoadPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Turnstile script'));
      document.head.appendChild(script);
    });
  }
  return scriptLoadPromise;
}

// Loaded on demand (not bundled) — only ever needed on the two anti-abuse-
// gated forms (registration, always; login, once LoginLockoutService flags
// the caller's IP — see AuthService.login/LoginPage.tsx). onToken fires
// with the solved token, or null once it expires/resets — Turnstile tokens
// are single-use and time-limited, so the caller must disable submit again
// once it goes back to null rather than reusing a stale one.
//
// Remounted (via a `key` prop change from the caller) rather than reset
// imperatively after a rejected submit — simpler than threading an
// imperative reset handle through, and Cloudflare's own script tears down
// and reinitializes cleanly on unmount/remount.
export function TurnstileWidget({ siteKey, onToken }: { siteKey: string; onToken: (token: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptFailed, setScriptFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        });
      })
      .catch(() => setScriptFailed(true));
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
    // onToken intentionally excluded — callers pass an inline setState
    // function that's a new reference every render; re-running this whole
    // effect on every render would tear down and re-render the widget
    // (visibly flickering, and burning through Cloudflare's per-session
    // challenge budget) for no reason. siteKey never actually changes at
    // runtime — kept in the deps array only because it'd be wrong to close
    // over a stale one if it somehow did.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  // Best-effort: an ad-blocker or network hiccup preventing the script from
  // loading shouldn't crash the page — submit just stays disabled forever
  // via the missing token, same as if the visitor never solved it.
  if (scriptFailed) return null;

  return <div ref={containerRef} />;
}
