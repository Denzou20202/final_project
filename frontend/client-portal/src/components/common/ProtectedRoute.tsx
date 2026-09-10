import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store.js';

export function ProtectedRoute() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.user?.role);

  // Staff signing in via the one shared login page land here first (this
  // app owns /login) — bounce them to their own app instead of showing a
  // client screen. A real navigation, not <Navigate>: operator-app is a
  // completely separate bundle, so this has to leave the SPA. It re-reads
  // the same shared localStorage session on load — already authenticated,
  // no second login.
  const isStaff = role === 'operator' || role === 'admin';
  useEffect(() => {
    // Guard against re-assigning window.location.href to the page it's
    // already on — that still forces a real reload even for an identical
    // URL, so without this check a staff token here turns into an infinite
    // reload loop the moment this bundle is ever reachable at the target
    // URL itself (e.g. `nx serve`, which has no separate app boundary and
    // serves this same bundle for every path). Same guard as api/client.ts's
    // 401 handler.
    if (isStaff && window.location.pathname !== '/staff/tickets') {
      window.location.href = '/staff/tickets';
    }
  }, [isStaff]);

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }
  if (isStaff) {
    return null;
  }

  return <Outlet />;
}
