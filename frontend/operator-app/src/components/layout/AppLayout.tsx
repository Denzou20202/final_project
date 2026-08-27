import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router-dom';
import { useForceLogout } from '../../hooks/useForceLogout.js';
import { useSyncLocale } from '../../hooks/useSyncLocale.js';
import { CloseIcon, MenuIcon } from '../common/icons.js';
import { MySettingsModal } from '../common/MySettingsModal.js';
import { ToastStack } from '../common/ToastStack.js';
import { CreateTicketModal } from '../tickets/CreateTicketModal.js';
import { IconRail } from './IconRail.js';
import { PendingRegistrationsModal } from './PendingRegistrationsModal.js';
import { ReportsHubModal } from './ReportsHubModal.js';
import { SettingsModal } from './SettingsModal.js';
import { Sidebar } from './Sidebar.js';
import { TagsModal } from './TagsModal.js';

export function AppLayout() {
  const { t } = useTranslation();
  useSyncLocale();
  useForceLogout();
  const location = useLocation();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isReportsOpen, setReportsOpen] = useState(false);
  const [isPendingRegistrationsOpen, setPendingRegistrationsOpen] = useState(false);
  const [isTagsOpen, setTagsOpen] = useState(false);
  const [isMySettingsOpen, setMySettingsOpen] = useState(false);
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);

  // Below the `md` breakpoint, IconRail (80px) + Sidebar (288px) don't leave
  // enough room for <main> to be usable next to them — they become a
  // slide-in drawer instead of sitting permanently in the flex row (see the
  // md:static/md:transform-none overrides below, which make this whole thing
  // inert again at md+). Auto-close on every navigation so the drawer
  // doesn't stay open covering whatever screen/ticket was just tapped into.
  //
  // isMySettingsOpen lives here (not inside Sidebar, unlike its own local
  // isTeamsOpen/isDeptFilterOpen) for a CSS reason, not just consistency:
  // any translate-x-* utility (even translate-x-0, the identity transform)
  // makes an element a containing block for its position:fixed descendants —
  // a <div>'s own `position` doesn't matter, only whether `transform` is
  // non-`none`. The drawer wrapper below always carries one of
  // -translate-x-full/translate-x-0 at every breakpoint, so a full-viewport
  // fixed modal rendered *inside* it (as MySettingsModal used to be, via its
  // own Sidebar-local state) gets sized/positioned against the drawer's own
  // ~368px box instead of the true viewport — not just off-screen on mobile,
  // but visibly squashed into a narrow column on desktop too, since md: only
  // neutralizes `position` (static) and `left/right`, never the transform
  // itself. Every other modal already lived up here as a sibling for
  // unrelated reasons (shared by IconRail *and* Sidebar); this is why it
  // has to.
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
        <IconRail
          isSettingsOpen={isSettingsOpen}
          onOpenSettings={() => setSettingsOpen(true)}
          isReportsOpen={isReportsOpen}
          onOpenReports={() => setReportsOpen(true)}
          isPendingRegistrationsOpen={isPendingRegistrationsOpen}
          onOpenPendingRegistrations={() => setPendingRegistrationsOpen(true)}
          isTagsOpen={isTagsOpen}
          onOpenTags={() => setTagsOpen(true)}
        />
        <Sidebar onCreateTicket={() => setCreateOpen(true)} onOpenMySettings={() => setMySettingsOpen(true)} />
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
      {isCreateOpen && <CreateTicketModal onClose={() => setCreateOpen(false)} />}
      {isSettingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {isReportsOpen && <ReportsHubModal onClose={() => setReportsOpen(false)} />}
      {isPendingRegistrationsOpen && (
        <PendingRegistrationsModal onClose={() => setPendingRegistrationsOpen(false)} />
      )}
      {isTagsOpen && <TagsModal onClose={() => setTagsOpen(false)} />}
      {isMySettingsOpen && <MySettingsModal onClose={() => setMySettingsOpen(false)} />}
      <ToastStack />
    </div>
  );
}
