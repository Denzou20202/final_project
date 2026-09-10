import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useCurrentUser, useLogout } from '../../hooks/useAuth.js';
import { useTicketCounts } from '../../hooks/useTickets.js';
import { useTicketStatuses } from '../../hooks/useTicketStatuses.js';
import { pickLocalized } from '../../lib/localized.js';
import { resolveStatusIdParam, statusUrlPosition } from '../../lib/status-url.js';
import { useSidebarHighlightStore } from '../../store/sidebar-highlight.store.js';
import { useThemeStore } from '../../store/theme.store.js';
import { GearIcon, MoonIcon, SunIcon } from '../common/icons.js';
import { Logo } from '../common/Logo.js';

function NavItem({
  label,
  dotColor,
  active,
  highlighted,
  count,
  onClick,
}: {
  label: string;
  dotColor?: string;
  active: boolean;
  // Unseen activity (a reply, or a status change) landed in this folder
  // since it was last opened — distinct from `active` (currently selected),
  // deliberately a different color so the two states never read as one.
  highlighted?: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors ${
        active
          ? 'bg-brand-50 font-semibold text-brand-700'
          : highlighted
            ? 'bg-priority-urgent/10 font-semibold text-ink ring-1 ring-inset ring-priority-urgent/30'
            : 'text-ink-muted hover:bg-surface-card'
      }`}
    >
      {dotColor && <span className="h-1.5 w-1.5 flex-none rounded-sm" style={{ backgroundColor: dotColor }} />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className={`flex-none rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold leading-none ${
            active
              ? 'bg-brand-600 text-white'
              : highlighted
                ? 'bg-priority-urgent text-white'
                : 'bg-surface-muted text-ink-faint'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function Sidebar({ onOpenMySettings }: { onOpenMySettings: () => void }) {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: me } = useCurrentUser();
  const logout = useLogout();
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const { data: statuses } = useTicketStatuses();
  const defaultStatus = statuses?.find((s) => s.isDefault);
  const { data: counts } = useTicketCounts();
  const { data: watchingCounts } = useTicketCounts({ watching: 'me' });
  // «Новые» (default status + no assignee yet) vs the default status's own
  // "assigned" folder (default status + staff already picked it up) is a
  // split on top of that one status — mirrors operator-app's
  // «Неприсвоенные»/«В работе» split. unassignedCounts feeds the «Новые»
  // folder's badge; assignedCounts.byStatus[defaultStatus.id] feeds the
  // default status's own folder (every other status keeps using the plain
  // `counts` above, since the split has no meaning once staff has moved a
  // ticket past the default status).
  const { data: unassignedCounts } = useTicketCounts({ assignedTo: 'unassigned' });
  const { data: assignedCounts } = useTicketCounts({ assignedTo: 'assigned' });
  const highlightedStatuses = useSidebarHighlightStore((s) => s.activeStatuses);
  const unassignedHighlighted = useSidebarHighlightStore((s) => s.unassignedActive);

  // Folder buttons must navigate to /tickets, not just rewrite the current
  // URL's query string — otherwise clicking «Новые» from /tickets/new or a
  // ticket detail page leaves you stranded there. Active-state flags are
  // likewise only meaningful while the ticket list itself is on screen.
  const onTicketsList = location.pathname === '/tickets';
  const activeStatus = onTicketsList ? resolveStatusIdParam(searchParams.get('statusId'), statuses) : null;
  const activeUnassigned = onTicketsList && searchParams.get('assignedTo') === 'unassigned';
  const watchingMe = onTicketsList && searchParams.get('watching') === 'me';

  function showAll() {
    navigate('/tickets');
  }
  function showStatus(statusId: string) {
    // Only the default-status folder needs the split — every other status
    // is already past the "brand new, nobody's touched it yet" stage the
    // assignedTo filter exists to carve out.
    const urlStatusId = statusUrlPosition(statusId, statuses) ?? statusId;
    navigate(
      statusId === defaultStatus?.id
        ? `/tickets?statusId=${urlStatusId}&assignedTo=assigned`
        : `/tickets?statusId=${urlStatusId}`,
    );
  }
  function showUnassigned() {
    // The default status, explicit — a ticket auto-closed while still
    // unassigned (automation/SLA can do this) shouldn't keep showing up
    // here forever.
    if (!defaultStatus) return;
    navigate(`/tickets?assignedTo=unassigned&statusId=${statusUrlPosition(defaultStatus.id, statuses) ?? defaultStatus.id}`);
  }
  function showWatching() {
    navigate('/tickets?watching=me');
  }

  return (
    <aside className="flex h-full w-72 flex-none flex-col border-r border-border bg-surface-sidebar/85 backdrop-blur-xl">
      <div className="flex items-center px-4 pb-3 pt-4">
        <Logo />
      </div>

      <div className="px-3.5 pb-3">
        <button
          type="button"
          onClick={() => navigate('/tickets/new')}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 py-2 text-[13.5px] font-semibold text-white hover:bg-brand-hover"
        >
          <span className="-mt-px text-base leading-none">+</span> {t('sidebar.newTicket')}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 pb-3">
        <div className="px-2 pb-1.5 pt-1 text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
          {t('sidebar.sectionTickets')}
        </div>
        <NavItem
          label={t('sidebar.allTickets')}
          active={onTicketsList && !activeStatus && !watchingMe}
          count={counts?.total}
          onClick={showAll}
        />
        <NavItem
          label={t('ticketStatusFolder.unassigned')}
          dotColor="#0D9488"
          active={activeUnassigned}
          highlighted={unassignedHighlighted}
          count={defaultStatus ? unassignedCounts?.byStatus[defaultStatus.id] : undefined}
          onClick={showUnassigned}
        />
        {(statuses ?? []).map((status) => (
          <NavItem
            key={status.id}
            label={status.key ? t(`ticketStatusFolder.${status.key}`) : pickLocalized(status.name, status.nameUk, status.nameEn, i18n.language)}
            dotColor={status.color}
            active={activeStatus === status.id && !activeUnassigned}
            highlighted={highlightedStatuses.includes(status.id)}
            count={status.id === defaultStatus?.id ? assignedCounts?.byStatus[status.id] : counts?.byStatus[status.id]}
            onClick={() => showStatus(status.id)}
          />
        ))}

        <div className="px-2 pb-1.5 pt-4 text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
          {t('sidebar.sectionMy')}
        </div>
        <NavItem label={t('sidebar.watching')} active={watchingMe} count={watchingCounts?.total} onClick={showWatching} />

        <div className="px-2 pb-1.5 pt-4 text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
          {t('sidebar.sectionKnowledge')}
        </div>
        <NavItem
          label={t('sidebar.knowledgeBase')}
          active={location.pathname.startsWith('/faq')}
          onClick={() => navigate('/faq')}
        />
      </nav>

      {/* Two rows, not one — a Russian ФИО (surname + name + patronymic,
          e.g. «Кулибин Иван Иванович») can run to 2-3 lines at this width,
          and a name block that tall can't safely share a row with
          fixed-size icons (see operator-app's Sidebar.tsx footer, fixed the
          same way the same day). Giving the name its own full-width row and
          moving theme/settings/logout to a second row below means neither
          row's content ever competes with the other for horizontal space. */}
      <div className="border-t border-border px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-elevated text-[11px] font-bold text-white">
            {me?.fullName.slice(0, 2).toUpperCase() ?? '…'}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="line-clamp-3 break-words text-[12.5px] font-medium leading-snug">
              {me?.fullName ?? t('common.loading')}
            </div>
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? t('sidebar.lightTheme') : t('sidebar.darkTheme')}
              aria-label={theme === 'dark' ? t('sidebar.lightTheme') : t('sidebar.darkTheme')}
              className="text-ink-subtle hover:text-brand-600"
            >
              {theme === 'dark' ? <SunIcon className="h-6 w-6" /> : <MoonIcon className="h-6 w-6" />}
            </button>
            <button
              type="button"
              onClick={onOpenMySettings}
              title={t('sidebar.mySettings')}
              className="text-ink-subtle hover:text-brand-600"
            >
              <GearIcon className="h-6 w-6" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => logout.mutate()}
            className="flex-none text-[13px] text-ink-subtle hover:text-priority-urgent"
          >
            {t('sidebar.logout')}
          </button>
        </div>
      </div>
    </aside>
  );
}
