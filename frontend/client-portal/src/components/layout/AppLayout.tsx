import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router-dom';
import { useCurrentUser } from '../../hooks/useAuth.js';
import { useForceLogout } from '../../hooks/useForceLogout.js';
import { useSyncLocale } from '../../hooks/useSyncLocale.js';
import { CloseIcon, MenuIcon } from '../common/icons.js';
import { MySettingsModal } from '../common/MySettingsModal.js';
import { OnboardingModal } from '../common/OnboardingModal.js';
import { ToastStack } from '../common/ToastStack.js';
import { Sidebar } from './Sidebar.js';

export function AppLayout() {
  const { t } = useTranslation();
  useSyncLocale();
  useForceLogout();
  const location = useLocation();
  // Live /users/me, not the persisted auth-store snapshot from login time —
  // profileCompletedAt only ever changes via OnboardingModal itself, and
  // this has to reflect that the moment it happens, not after a re-login.
  const { data: me } = useCurrentUser();
  const needsOnboarding = me?.role === 'client' && me.profileCompletedAt == null;
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMySettingsOpen, setMySettingsOpen] = useState(false);

  // Below the `md` breakpoint, the 288px-wide Sidebar alongside <main>
  // leaves too little room to be usable — it becomes a slide-in drawer
  // instead (see the md:static/md:transform-none overrides below, which make
  // this whole thing inert again at md+). Auto-close on every navigation so
  // the drawer doesn't stay open covering whatever was just tapped into.
  //
  // isMySettingsOpen lives here, not inside Sidebar, for a CSS reason: any
  // translate-x-* utility (even translate-x-0, the identity transform) makes
  // an element a containing block for its position:fixed descendants,
  // regardless of that element's own `position` value. The drawer wrapper
  // below always carries one of -translate-x-full/translate-x-0, so a
  // full-viewport fixed modal rendered *inside* it (as MySettingsModal used
  // to be, via its own Sidebar-local state) gets sized/positioned against
  // the drawer's own ~288px box instead of the true viewport — not just
  // off-screen on mobile, but visibly squashed into a narrow column on
  // desktop too, since md: only neutralizes `position`/`left`, never the
  // transform itself.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden">
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileNavOpen(false)} />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-40 flex -translate-x-full transition-transform duration-200 md:static md:transform-none md:transition-none ${
          isMobileNavOpen ? 'translate-x-0' : ''
        }`}
      >
        <Sidebar onOpenMySettings={() => setMySettingsOpen(true)} />
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          aria-label={t('common.closeMenu')}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-surface-card text-ink-muted shadow-sm md:hidden"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted/60 backdrop-blur-sm">
        <div className="flex flex-none items-center border-b border-border px-2 py-1.5 md:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label={t('common.openMenu')}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-ink-muted hover:bg-surface-muted"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </main>
      <ToastStack />
      {needsOnboarding && <OnboardingModal />}
      {isMySettingsOpen && <MySettingsModal onClose={() => setMySettingsOpen(false)} />}
    </div>
  );
}
