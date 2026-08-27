import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useCurrentUser, useLogout } from '../../hooks/useAuth.js';
import { useCustomFieldDefinitions } from '../../hooks/useCustomFields.js';
import { useIdleReporter } from '../../hooks/useIdleReporter.js';
import { useMacros } from '../../hooks/useMacros.js';
import { useTeams } from '../../hooks/useTeams.js';
import { useTicketCounts, useTicketCountsByTeam, useTrash } from '../../hooks/useTickets.js';
import { useTicketStatuses } from '../../hooks/useTicketStatuses.js';
import { useAssignableUsers } from '../../hooks/useUsers.js';
import { pickLocalized } from '../../lib/localized.js';
import { resolveStatusIdParam, statusUrlPosition } from '../../lib/status-url.js';
import type { PublicTeam, PublicTeamTicketCounts, PublicTicketStatus, PublicUser } from '../../lib/types.js';
import { useSidebarDepartmentsStore } from '../../store/sidebar-departments.store.js';
import { useSidebarHighlightStore } from '../../store/sidebar-highlight.store.js';
import { useThemeStore } from '../../store/theme.store.js';
import { ChevronDownIcon, GearIcon, MoonIcon, SunIcon } from '../common/icons.js';
import { Logo } from '../common/Logo.js';
import { DepartmentFilterPopover } from './DepartmentFilterPopover.js';
import { StatusPicker } from './StatusPicker.js';

function NavItem({
  label,
  dotColor,
  active,
  highlighted,
  count,
  indent,
  onClick,
}: {
  label: string;
  dotColor?: string;
  active: boolean;
  // Unseen activity (a new ticket, or a reply) landed in this folder since
  // it was last opened — distinct from `active` (currently selected), and
  // deliberately a different color so the two states never read as one.
  highlighted?: boolean;
  count?: number;
  // Status rows nested under an expanded department accordion sit one step
  // in (1); an operator's own status rows, nested under that, sit two steps
  // in (2).
  indent?: 1 | 2;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg py-2 text-left text-[13.5px] transition-colors ${indent === 2 ? 'pl-10 pr-2.5' : indent === 1 ? 'pl-6 pr-2.5' : 'px-2.5'} ${
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

// Clicking a department row expands it into its «Операторы» list instead of
// navigating straight to the department's ticket list — same for both staff
// roles. Each operator shows their own ticket total within this team, and
// expanding one reveals their own per-status breakdown.
function TeamStatusAccordion({
  team,
  counts,
  isOpen,
  onToggle,
  activeTeamId,
  activeStatus,
  activeAssignedTo,
  operators,
  statuses,
  openAssigneeIds,
  onToggleAssignee,
  onSelectAssigneeStatus,
}: {
  team: PublicTeam;
  counts: PublicTeamTicketCounts | undefined;
  isOpen: boolean;
  onToggle: () => void;
  activeTeamId: string | null;
  activeStatus: string | null;
  activeAssignedTo: string | null;
  operators: PublicUser[];
  statuses: PublicTicketStatus[];
  openAssigneeIds: Set<string>;
  onToggleAssignee: (teamId: string, userId: string) => void;
  onSelectAssigneeStatus: (teamId: string, userId: string, statusId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const isTeamActive = activeTeamId === team.id;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors ${
          isTeamActive && !activeStatus && !activeAssignedTo ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink-muted hover:bg-surface-card'
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{pickLocalized(team.name, team.nameUk, team.nameEn, i18n.language)}</span>
        {!!counts?.total && (
          <span className="flex-none rounded-full bg-surface-muted px-1.5 py-0.5 text-[10.5px] font-semibold leading-none text-ink-faint">
            {counts.total}
          </span>
        )}
        <ChevronDownIcon className={`h-3 w-3 flex-none text-ink-faint transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && operators.length > 0 && (
        <>
          <div className="px-2 py-1 pl-6 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
            {t('sidebar.teamOperators')}
          </div>
          {operators.map((operator) => {
            const isAssigneeOpen = openAssigneeIds.has(`${team.id}:${operator.id}`);
            const isAssigneeActive = isTeamActive && activeAssignedTo === operator.id;
            const operatorCounts = counts?.byAssignee[operator.id];
            return (
              <div key={operator.id}>
                <button
                  type="button"
                  onClick={() => onToggleAssignee(team.id, operator.id)}
                  className={`flex w-full items-center gap-2 rounded-lg py-2 pl-6 pr-2.5 text-left text-[13.5px] transition-colors ${
                    isAssigneeActive && !activeStatus
                      ? 'bg-brand-50 font-semibold text-brand-700'
                      : 'text-ink-muted hover:bg-surface-card'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{operator.fullName}</span>
                  {!!operatorCounts?.total && (
                    <span className="flex-none rounded-full bg-surface-muted px-1.5 py-0.5 text-[10.5px] font-semibold leading-none text-ink-faint">
                      {operatorCounts.total}
                    </span>
                  )}
                  <ChevronDownIcon
                    className={`h-3 w-3 flex-none text-ink-faint transition-transform ${isAssigneeOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isAssigneeOpen &&
                  statuses.map((status) => (
                    <NavItem
                      key={status.id}
                      indent={2}
                      label={status.key ? t(`ticketStatusFolder.${status.key}`) : pickLocalized(status.name, status.nameUk, status.nameEn, i18n.language)}
                      dotColor={status.color}
                      active={isAssigneeActive && activeStatus === status.id}
                      count={operatorCounts?.byStatus[status.id]}
                      onClick={() => onSelectAssigneeStatus(team.id, operator.id, status.id)}
                    />
                  ))}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

export function Sidebar({
  onCreateTicket,
  onOpenMySettings,
}: {
  onCreateTicket: () => void;
  onOpenMySettings: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: me } = useCurrentUser();
  const logout = useLogout();
  useIdleReporter();
  const { data: teams } = useTeams();
  const { data: statuses } = useTicketStatuses();
  // Not read anywhere in this component — warmed here purely so they're
  // already cached (['custom-fields']/['macros']) by the time
  // AutomationRuleModal opens, same reason teams/statuses/assignableUsers
  // are fetched in this always-mounted component rather than only inside
  // whatever modal actually needs them. Without this, a rule referencing a
  // macro or custom field can be opened for editing before either list has
  // loaded anywhere else in the session, and the register()-only selects in
  // ActionRow/ConditionRow render unselected with nothing to re-sync them —
  // see AutomationRuleModal's own comment, and EditUserModal's `values`
  // fix for the identical bug class.
  useCustomFieldDefinitions();
  useMacros();
  const defaultStatus = statuses?.find((s) => s.isDefault);
  const [isTeamsOpen, setTeamsOpen] = useState(true);
  const [isDeptFilterOpen, setDeptFilterOpen] = useState(false);
  const deptFilterAnchorRef = useRef<HTMLButtonElement>(null);
  const [openTeamIds, setOpenTeamIds] = useState<Set<string>>(new Set());
  // Keyed `${teamId}:${userId}` — an operator can appear open in one team's
  // accordion and closed in another's, so a flat per-user Set isn't enough.
  const [openAssigneeKeys, setOpenAssigneeKeys] = useState<Set<string>>(new Set());
  const hiddenTeamIds = useSidebarDepartmentsStore((s) => s.hiddenTeamIds);
  const highlightedStatuses = useSidebarHighlightStore((s) => s.activeStatuses);
  const unassignedHighlighted = useSidebarHighlightStore((s) => s.unassignedActive);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const { data: counts } = useTicketCounts();
  // One request for every team's counts, instead of TeamStatusAccordion
  // firing its own per-item request.
  const { data: countsByTeam } = useTicketCountsByTeam();
  const isAdmin = me?.role === 'admin';
  const isOperator = me?.role === 'operator';
  const isStaff = isAdmin || isOperator;
  // Both staff roles now (Корзина used to be admin-only — see tickets
  // .controller.ts's @Roles(OPERATOR, ADMIN) on trash/restore).
  const { data: trash } = useTrash({ enabled: isStaff });
  const { data: watchingCounts } = useTicketCounts({ watching: 'me' });
  const { data: mentionedCounts } = useTicketCounts({ mentioned: 'me' });
  // Client role never reaches this component's isStaff branch (see
  // ProtectedRoute), but guard with `enabled` anyway rather than relying on
  // that — an unassigned-tickets count has no meaning for a client's own
  // ticket list.
  const { data: unassignedCounts } = useTicketCounts({ assignedTo: 'unassigned' }, { enabled: isStaff });
  // Status-folder badges must match what showStatus() actually filters to.
  // An admin's status folders show the whole team's queue (status +
  // assignedTo=assigned) — counts.byStatus above stays unfiltered by
  // assignee on purpose, since it also backs «Все тикеты»'s true global
  // total (see that NavItem further down). An operator's status folders
  // show only their own queue (status + assignedTo=<their id>) — the
  // «Отделы» accordion below is the only place an operator still sees
  // every colleague's tickets, deliberately untouched by this split.
  const { data: assignedCounts } = useTicketCounts({ assignedTo: 'assigned' }, { enabled: isStaff && isAdmin });
  const { data: myCounts } = useTicketCounts({ assignedTo: me?.id }, { enabled: isStaff && isOperator });
  const visibleTeams = (teams ?? []).filter((team) => !hiddenTeamIds.includes(team.id));
  // Backs the per-team accordion's operator list — shares the ['users']
  // query key with the Users page/assignee pickers, so this doesn't add a
  // second independent fetch of the same data.
  const { data: usersPage } = useAssignableUsers();
  // Sidebar re-renders on every route/query-string change (useLocation/
  // useSearchParams above) — every ticket click, every debounced search
  // keystroke, every filter change. Without this memo, the filter+sort
  // below re-ran unconditionally for every visible team on every one of
  // those renders, not just when the underlying data actually changed.
  const operatorsByTeam = useMemo(() => {
    const staff = (usersPage?.items ?? []).filter((u) => u.role !== 'client' && !u.deactivatedAt);
    const map = new Map<string, PublicUser[]>();
    for (const team of teams ?? []) {
      map.set(
        team.id,
        staff.filter((u) => team.memberIds.includes(u.id)).sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru')),
      );
    }
    return map;
  }, [usersPage, teams]);

  // Folder buttons must navigate to /tickets, not just rewrite the current
  // URL's query string — otherwise clicking «Новые» from the knowledge base
  // or SLA pages leaves you stranded on that page. Active-state flags are
  // likewise only meaningful while the ticket list itself is on screen.
  const onTicketsList = location.pathname === '/tickets';
  const activeStatus = onTicketsList ? resolveStatusIdParam(searchParams.get('statusId'), statuses) : null;
  const assignedToMe = onTicketsList && searchParams.get('assignedTo') === 'me';
  const activeUnassigned = onTicketsList && searchParams.get('assignedTo') === 'unassigned';
  // Raw value (operator id, 'unassigned', or null) — powers the per-team
  // accordion's operator drill-down, which needs more than the boolean
  // activeUnassigned/assignedToMe flags above already cover.
  const activeAssignedTo = onTicketsList ? searchParams.get('assignedTo') : null;
  const activeTeamId = onTicketsList ? searchParams.get('teamId') : null;
  const activeTagId = onTicketsList ? searchParams.get('tagId') : null;
  const watchingMe = onTicketsList && searchParams.get('watching') === 'me';
  const mentionedMe = onTicketsList && searchParams.get('mentioned') === 'me';

  function showAll() {
    navigate('/tickets');
  }
  // An operator's status folders are their OWN queue — assignedTo=me,
  // resolved to their real id further down the chain (TicketsPage.tsx
  // already has this sentinel wired up for the list/counts queries). An
  // admin's status folders stay the whole team's queue — assignedTo=assigned,
  // i.e. "has SOME assignee" rather than "assigned to a specific person" —
  // this isn't about WHO the assignee is, it's about excluding tickets with
  // NO assignee at all, so a freshly created ticket (status=open, unassigned)
  // doesn't show up in both this status folder AND «Неприсвоенные» at once.
  // Either way, the «Отделы» accordion below is untouched by this split —
  // it's deliberately still the one place an operator sees every
  // colleague's tickets (department-wide oversight, not personal triage).
  function showStatus(statusId: string) {
    const assignedTo = isOperator ? 'me' : 'assigned';
    navigate(`/tickets?statusId=${statusUrlPosition(statusId, statuses) ?? statusId}&assignedTo=${assignedTo}`);
  }
  function showWatching() {
    navigate('/tickets?watching=me');
  }
  function showMentioned() {
    navigate('/tickets?mentioned=me');
  }
  function showUnassigned() {
    // The default status, explicit — mirrors showStatus()'s own
    // assignedTo=assigned sentinel above. Without it, a ticket auto-closed
    // while still unassigned (an automation rule or SLA escalation can do
    // this) would keep showing up here forever.
    if (!defaultStatus) return;
    navigate(`/tickets?assignedTo=unassigned&statusId=${statusUrlPosition(defaultStatus.id, statuses) ?? defaultStatus.id}`);
  }
  function showTeamAssigneeStatus(teamId: string, assigneeId: string, statusId: string) {
    navigate(`/tickets?teamId=${teamId}&assignedTo=${assigneeId}&statusId=${statusUrlPosition(statusId, statuses) ?? statusId}`);
  }
  function toggleTeamOpen(teamId: string) {
    setOpenTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }
  function toggleAssigneeOpen(teamId: string, userId: string) {
    const key = `${teamId}:${userId}`;
    setOpenAssigneeKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <aside className="flex h-full w-72 flex-none flex-col border-r border-border bg-surface-sidebar/85 backdrop-blur-xl">
      <div className="flex items-center px-4 pb-3 pt-4">
        <Logo />
      </div>

      <div className="px-3.5 pb-3">
        <button
          type="button"
          onClick={onCreateTicket}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 py-2 text-[13.5px] font-semibold text-white hover:bg-brand-hover"
        >
          <span className="-mt-px text-base leading-none">+</span> {t('sidebar.createTicket')}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 pb-3">
        <div className="px-2 pb-1.5 pt-1 text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
          {t('sidebar.sectionTickets')}
        </div>
        {isStaff && (
          <NavItem
            label={t('sidebar.unassigned')}
            active={activeUnassigned}
            highlighted={unassignedHighlighted}
            count={defaultStatus ? unassignedCounts?.byStatus[defaultStatus.id] : undefined}
            onClick={showUnassigned}
          />
        )}
        {(statuses ?? []).map((status) => (
          <NavItem
            key={status.id}
            label={status.key ? t(`ticketStatusFolder.${status.key}`) : pickLocalized(status.name, status.nameUk, status.nameEn, i18n.language)}
            dotColor={status.color}
            active={activeStatus === status.id && !activeTeamId && !activeUnassigned}
            highlighted={highlightedStatuses.includes(status.id)}
            count={isOperator ? myCounts?.byStatus[status.id] : assignedCounts?.byStatus[status.id]}
            onClick={() => showStatus(status.id)}
          />
        ))}
        {isStaff && (
          <NavItem
            label={t('sidebar.trash')}
            active={location.pathname === '/trash'}
            count={trash?.length}
            onClick={() => navigate('/trash')}
          />
        )}
        {/* «Под контролем» — the one survivor of the old «Мои» section,
            now shared by both roles right here instead of its own header. */}
        <NavItem label={t('sidebar.watching')} active={watchingMe} count={watchingCounts?.total} onClick={showWatching} />
        <NavItem
          label={t('sidebar.mentions')}
          active={mentionedMe}
          count={mentionedCounts?.total}
          onClick={showMentioned}
        />
        <NavItem
          label={t('sidebar.allTickets')}
          active={
            onTicketsList &&
            !activeStatus &&
            !assignedToMe &&
            !activeUnassigned &&
            !activeTeamId &&
            !activeTagId &&
            !watchingMe &&
            !mentionedMe
          }
          count={counts?.total}
          onClick={showAll}
        />

        {teams && teams.length > 0 && (
          <>
            {/* Text-styling classes (uppercase/tracking/size/color) go on
                the toggle button ITSELF, not just the wrapper — buttons
                don't reliably inherit text-transform from an ancestor (the
                browser's own form-control reset wins over the inherited
                value), which is why this used to render as «Отделы»
                instead of «ОТДЕЛЫ». */}
            <div className="mt-2 flex items-center gap-1 border-t border-border px-2 pb-1.5 pt-3">
              <button
                type="button"
                onClick={() => setTeamsOpen((open) => !open)}
                className="flex min-w-0 flex-1 items-center justify-between text-[10.5px] font-bold uppercase tracking-wider text-ink-faint hover:text-brand-600"
              >
                <span>{t('sidebar.sectionTeams')}</span>
                <ChevronDownIcon className={`h-3 w-3 transition-transform ${isTeamsOpen ? 'rotate-180' : ''}`} />
              </button>
              <button
                ref={deptFilterAnchorRef}
                type="button"
                onClick={() => setDeptFilterOpen((open) => !open)}
                title={t('sidebar.configureVisibleTeams')}
                aria-label={t('sidebar.configureVisibleTeams')}
                className="flex-none rounded p-0.5 text-ink-faint hover:bg-surface-card hover:text-brand-600"
              >
                <GearIcon className="h-3 w-3" />
              </button>
            </div>
            {isDeptFilterOpen && (
              <DepartmentFilterPopover
                teams={teams}
                anchorRef={deptFilterAnchorRef}
                onClose={() => setDeptFilterOpen(false)}
              />
            )}
            {isTeamsOpen &&
              visibleTeams.map((team) => (
                <TeamStatusAccordion
                  key={team.id}
                  team={team}
                  counts={countsByTeam?.[team.id]}
                  isOpen={openTeamIds.has(team.id)}
                  onToggle={() => toggleTeamOpen(team.id)}
                  activeTeamId={activeTeamId}
                  activeStatus={activeStatus}
                  activeAssignedTo={activeAssignedTo}
                  operators={operatorsByTeam.get(team.id) ?? []}
                  statuses={statuses ?? []}
                  openAssigneeIds={openAssigneeKeys}
                  onToggleAssignee={toggleAssigneeOpen}
                  onSelectAssigneeStatus={showTeamAssigneeStatus}
                />
              ))}
          </>
        )}
      </nav>

      {/* Two rows, not one — a Russian ФИО (surname + name + patronymic,
          e.g. «Кулибин Иван Иванович») can run to 2-3 lines at this width,
          and a name block that tall can't safely share a row with
          fixed-size icons: the icons would just sit centered next to it,
          but the name column's own width would be squeezed by however much
          room the icons need, making wrapping kick in even earlier. Giving
          the name its own full-width row and moving theme/settings/logout
          to a second row below sidesteps that entirely — neither row's
          content ever competes with the other for horizontal space. */}
      <div className="border-t border-border px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-elevated text-[11px] font-bold text-white">
            {me?.fullName.slice(0, 2).toUpperCase() ?? '…'}
          </div>
          <StatusPicker />
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
