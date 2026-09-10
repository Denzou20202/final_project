import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store.js';

export function ProtectedRoute() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.user?.role);

  // operator-app has no login page of its own — client-portal's /login is
  // the one shared login page for every role. Both redirects are real
  // navigations (window.location, not <Navigate>) since they cross into
  // the other app's separate bundle; the destination re-reads the same
  // shared localStorage session on load.
  // ?portal=staff tells the shared LoginPage which audience this attempt is
  // — it's the only signal available before any credentials are known, and
  // OIDC's redirect-based flow needs it to build the right authorization
  // URL (staff and client can point at different IdP app registrations).
  const isClient = role === 'client';
  useEffect(() => {
    // Guard against re-assigning window.location.href to the page it's
    // already on — unlike a client-side route change, that still triggers
    // a real navigation in the browser, so without this check a stale/
    // never-set token turns this into an infinite reload loop the moment
    // this app is ever reachable at the target URL itself (e.g. `nx serve`,
    // which has no separate app boundary and serves this same bundle for
    // every path including /login). Same guard as api/client.ts's 401
    // handler, applied here too.
    if (!accessToken) {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?portal=staff';
      }
    } else if (isClient) {
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
  }, [accessToken, isClient]);

  if (!accessToken || isClient) {
    return null;
  }

  return <Outlet />;
}
