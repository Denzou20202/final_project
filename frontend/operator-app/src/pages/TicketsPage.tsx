import { SortOrder, TicketSortField } from '@veloxdesk/types';
import type { TicketPriority } from '@veloxdesk/types';
import { useQueryClient } from '@tanstack/react-query';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Checkbox } from '../components/common/Checkbox.js';
import { BookmarkIcon, GearIcon } from '../components/common/icons.js';
import { VipBadge } from '../components/common/VipBadge.js';
import { BulkAssignModal } from '../components/tickets/BulkAssignModal.js';
import { BulkReplyModal } from '../components/tickets/BulkReplyModal.js';
import { COLUMN_LABEL_KEYS, ColumnSettingsPopover } from '../components/tickets/ColumnSettingsPopover.js';
import { PriorityBadge } from '../components/tickets/PriorityBadge.js';
import { SavedFiltersPopover } from '../components/tickets/SavedFiltersPopover.js';
import { StatusBadge } from '../components/tickets/StatusBadge.js';
import { useCurrentUser } from '../hooks/useAuth.js';
import { useSlaPolicies } from '../hooks/useSlaPolicies.js';
import { useAllTags } from '../hooks/useTags.js';
import { useTeams } from '../hooks/useTeams.js';
import { useTicketCounts, useTicketsPage } from '../hooks/useTickets.js';
import { useTicketStatuses } from '../hooks/useTicketStatuses.js';
import { useUserLookup, useUserVipLookup } from '../hooks/useUserLookup.js';
import { deleteTicket, mergeTicket, updateTicketStatus } from '../lib/api/tickets.api.js';
import { formatDateTime as formatDate } from '../lib/format.js';
import { pickLocalized } from '../lib/localized.js';
import { resolveStatusIdParam } from '../lib/status-url.js';
import type { PublicTicket } from '../lib/types.js';
import { useRecentActivityStore } from '../store/recent-activity.store.js';
import { useSidebarHighlightStore } from '../store/sidebar-highlight.store.js';
import { PAGE_SIZE_OPTIONS, useTicketTableStore, type TicketColumnKey } from '../store/ticket-table.store.js';

// Urgent-first — the priority dropdown filter reads most-important-on-top.
const PRIORITY_FILTER_ORDER: TicketPriority[] = [
  'urgent' as TicketPriority,
  'high' as TicketPriority,
  'medium' as TicketPriority,
  'low' as TicketPriority,
];

const COLUMN_SORT_FIELDS: Partial<Record<TicketColumnKey, TicketSortField>> = {
  number: TicketSortField.TICKET_NUMBER,
  title: TicketSortField.TITLE,
  status: TicketSortField.STATUS,
  priority: TicketSortField.PRIORITY,
  createdAt: TicketSortField.CREATED_AT,
};

// Every column has its own explicit default width — none of them is a
// silent "flex" column, so resizing one never reflows the others. The
// table's own width is the sum of these (see totalTableWidth below); the
// `overflow-x-auto` wrapper takes over with a scrollbar once that sum
// exceeds the card's width.
const DEFAULT_WIDTHS: Record<TicketColumnKey, number> = {
  number: 90,
  title: 280,
  client: 160,
  assignee: 160,
  team: 140,
  sla: 130,
  status: 130,
  priority: 130,
  createdAt: 150,
};


// Memoized so a re-render of TicketsPage that doesn't actually change this
// row's own data (the classic case: typing in the search box re-renders the
// page well before the debounce fires a new query) skips re-rendering every
// currently-loaded row, not just the one query result. Requires every prop
// here to actually be reference-stable across unrelated re-renders — see
// visibleColumns' useMemo and onToggle's useCallback in TicketsPage.
const TicketRow = memo(function TicketRow({
  ticket,
  visibleColumns,
  isRecent,
  isSelected,
  lookupUser,
  isVip,
  teams,
  slaPolicies,
  onToggle,
  navigate,
}: {
  ticket: PublicTicket;
  visibleColumns: TicketColumnKey[];
  isRecent: boolean;
  isSelected: boolean;
  lookupUser: (id: string | null | undefined) => string;
  isVip: (id: string | null | undefined) => boolean;
  teams: ReturnType<typeof useTeams>['data'];
  slaPolicies: ReturnType<typeof useSlaPolicies>['data'];
  onToggle: (id: string) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const { t, i18n } = useTranslation();

  function bodyCell(key: TicketColumnKey) {
    switch (key) {
      case 'number':
        return (
          <td key={key} className="truncate px-4 py-3 text-ink-faint">
            <span className="flex items-center gap-1.5">
              {isRecent && <span className="h-1.5 w-1.5 flex-none rounded-full bg-brand-600" />}#{ticket.ticketNumber}
            </span>
          </td>
        );
      case 'title':
        return (
          <td key={key} className={`truncate px-4 py-3 ${isRecent ? 'font-bold' : 'font-medium'}`}>
            {ticket.title}
          </td>
        );
      case 'client':
        return (
          <td key={key} className="truncate px-4 py-3 text-ink-muted">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span className="truncate">{lookupUser(ticket.createdBy)}</span>
              {isVip(ticket.createdBy) && <VipBadge />}
            </span>
          </td>
        );
      case 'assignee':
        return (
          <td key={key} className="truncate px-4 py-3 text-ink-muted">
            {lookupUser(ticket.assignedTo)}
          </td>
        );
      case 'team': {
        const team = ticket.teamId ? teams?.find((tm) => tm.id === ticket.teamId) : undefined;
        return (
          <td key={key} className="truncate px-4 py-3 text-ink-muted">
            {team ? pickLocalized(team.name, team.nameUk, team.nameEn, i18n.language) : '—'}
          </td>
        );
      }
      case 'sla':
        return (
          <td key={key} className="truncate px-4 py-3 text-ink-muted">
            {(ticket.slaPolicyId && slaPolicies?.find((p) => p.id === ticket.slaPolicyId)?.name) || '—'}
          </td>
        );
      case 'status':
        return (
          <td key={key} className="truncate px-4 py-3">
            <StatusBadge status={ticket.status} unassigned={!ticket.assignedTo} />
          </td>
        );
      case 'priority':
        return (
          <td key={key} className="truncate px-4 py-3">
            <PriorityBadge priority={ticket.priority} />
          </td>
        );
      case 'createdAt':
        return (
          <td key={key} className="truncate px-4 py-3 text-ink-subtle">
            {formatDate(ticket.createdAt, i18n.language)}
          </td>
        );
    }
  }

  return (
    <tr
      onClick={() => navigate(`/tickets/${ticket.id}`)}
      className={`cursor-pointer border-b border-border-subtle text-[13.5px] last:border-0 hover:bg-surface-muted ${
        isRecent ? 'bg-brand-50/60' : ''
      } ${isSelected ? 'bg-brand-50' : ''}`}
    >
      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          aria-label={t('tickets.selectRow', { number: ticket.ticketNumber })}
          checked={isSelected}
          onChange={() => onToggle(ticket.id)}
        />
      </td>
      {visibleColumns.map((key) => bodyCell(key))}
    </tr>
  );
});

export default function TicketsPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const { data: teams } = useTeams();
  const { data: slaPolicies } = useSlaPolicies();
  const { data: tags } = useAllTags();
  const { data: statuses } = useTicketStatuses();
  const lookupUser = useUserLookup();
  const isVip = useUserVipLookup();
  const activeTicketIds = useRecentActivityStore((s) => s.activeTicketIds);

  const columnOrder = useTicketTableStore((s) => s.order);
  const hiddenColumns = useTicketTableStore((s) => s.hidden);
  const columnWidths = useTicketTableStore((s) => s.widths);
  const setColumnWidth = useTicketTableStore((s) => s.setWidth);
  const pageSize = useTicketTableStore((s) => s.pageSize);
  const setPageSize = useTicketTableStore((s) => s.setPageSize);
  // Memoized so it's not a fresh array reference on every render (e.g. a
  // search-box keystroke) — TicketRow is memoized below and reads this as a
  // prop, so a stable reference here is what lets rows actually skip
  // re-rendering instead of the memo comparison always seeing "changed".
  const visibleColumns = useMemo(
    () => columnOrder.filter((key) => !hiddenColumns[key]),
    [columnOrder, hiddenColumns],
  );

  const status = resolveStatusIdParam(searchParams.get('statusId'), statuses);
  const clearFolderHighlight = useSidebarHighlightStore((s) => s.clear);
  useEffect(() => {
    if (status) clearFolderHighlight(status);
  }, [status, clearFolderHighlight]);
  const assignedToParam = searchParams.get('assignedTo');
  // «Неприсвоенные» is its own folder (status=open, assignedTo=unassigned) —
  // its highlight lives separately from activeStatuses' 'open' entry (see
  // sidebar-highlight.store.ts), so it needs its own clear-on-view effect too.
  const clearUnassignedHighlight = useSidebarHighlightStore((s) => s.clearUnassigned);
  useEffect(() => {
    if (assignedToParam === 'unassigned') clearUnassignedHighlight();
  }, [assignedToParam, clearUnassignedHighlight]);
  const priority = searchParams.get('priority') as TicketPriority | null;
  const teamId = searchParams.get('teamId') ?? undefined;
  const tagId = searchParams.get('tagId') ?? undefined;
  const watching = searchParams.get('watching') === 'me' ? ('me' as const) : undefined;
  const mentioned = searchParams.get('mentioned') === 'me' ? ('me' as const) : undefined;
  const rawSearch = searchParams.get('q');
  const search = rawSearch?.trim() ? rawSearch : undefined;
  const assignedTo = assignedToParam === 'me' ? me?.id : (assignedToParam ?? undefined);
  const sortBy = (searchParams.get('sortBy') as TicketSortField | null) ?? TicketSortField.CREATED_AT;
  const sortOrder = (searchParams.get('sortOrder') as SortOrder | null) ?? SortOrder.DESC;

  // «Ищите нужные заявки при помощи поиска» — the draft is local so typing
  // stays instant; the URL (and with it the actual query) updates after a
  // short pause, and lands in history as replace so Back doesn't step
  // through every keystroke.
  const [searchDraft, setSearchDraft] = useState(searchParams.get('q') ?? '');
  // Sync the draft FROM the URL for any change this input itself didn't
  // cause — clicking the Logo (navigate('/tickets')), a saved-filter preset
  // (applyPresetSearch), or browser back/forward all rewrite `q` without
  // touching this local state. Without this, the box kept showing stale
  // text after such a navigation, and the debounce effect below would even
  // write that stale text straight back into the "cleared" URL.
  useEffect(() => {
    setSearchDraft(searchParams.get('q') ?? '');
  }, [searchParams]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const current = searchParams.get('q') ?? '';
      const next = searchDraft;
      if (next === current) return;
      const params = new URLSearchParams(searchParams);
      if (next.trim()) params.set('q', next);
      else params.delete('q');
      setSearchParams(params, { replace: true });
    }, 350);
    return () => clearTimeout(timer);
  }, [searchDraft, searchParams, setSearchParams]);

  const filters = useMemo(
    () => ({
      statusId: status ?? undefined,
      priority: priority ?? undefined,
      assignedTo,
      teamId,
      tagId,
      watching,
      mentioned,
      search,
      sortBy,
      sortOrder,
      limit: pageSize,
    }),
    [status, priority, assignedTo, teamId, tagId, watching, mentioned, search, sortBy, sortOrder, pageSize],
  );

  // Declared ahead of the pagination block below since goToNextPage/
  // goToPrevPage and the filter-change effect all clear it too.
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Real pagination (not "load more") — pageCursors[i] is the cursor that
  // fetches page i (index 0), so Prev never needs to re-derive anything, it
  // just steps back to an already-known index. Every filter/pageSize change
  // must restart at page 1 — a cursor from the old filter set is meaningless
  // against the new one.
  const [pageCursors, setPageCursors] = useState<(string | undefined)[]>([undefined]);
  const [pageIndex, setPageIndex] = useState(0);
  const listContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setPageCursors([undefined]);
    setPageIndex(0);
    setSelected(new Set());
    listContainerRef.current?.scrollTo({ top: 0 });
  }, [status, priority, assignedTo, teamId, tagId, watching, mentioned, search, sortBy, sortOrder, pageSize]);

  const { data, isLoading, isError, isFetching } = useTicketsPage(filters, pageCursors[pageIndex]);
  const { data: counts } = useTicketCounts({
    priority: priority ?? undefined,
    assignedTo,
    teamId,
    tagId,
    watching,
    mentioned,
    search,
  });
  const tickets = data?.items ?? [];
  const hasNextPage = !!data?.nextCursor;
  const hasPrevPage = pageIndex > 0;

  function goToNextPage() {
    if (!data?.nextCursor) return;
    setPageCursors((prev) => {
      const next = [...prev];
      next[pageIndex + 1] = data.nextCursor ?? undefined;
      return next;
    });
    setPageIndex((i) => i + 1);
    setSelected(new Set());
    listContainerRef.current?.scrollTo({ top: 0 });
  }

  function goToPrevPage() {
    setPageIndex((i) => Math.max(0, i - 1));
    setSelected(new Set());
    listContainerRef.current?.scrollTo({ top: 0 });
  }

  // ===== Bulk selection =====
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [isReplyOpen, setReplyOpen] = useState(false);
  const [isAssignOpen, setAssignOpen] = useState(false);
  const [isColumnsOpen, setColumnsOpen] = useState(false);
  const columnsButtonRef = useRef<HTMLButtonElement>(null);
  const [isSavedFiltersOpen, setSavedFiltersOpen] = useState(false);
  const savedFiltersButtonRef = useRef<HTMLButtonElement>(null);
  const [isBulkBusy, setBulkBusy] = useState(false);

  function applyPresetSearch(search: string) {
    setSearchParams(new URLSearchParams(search));
  }

  const allOnPageSelected = tickets.length > 0 && tickets.every((t) => selected.has(t.id));
  const someSelected = selected.size > 0;

  // useCallback (not a plain function) so TicketRow's memo comparison sees a
  // stable onToggle prop across re-renders — setSelected's functional-update
  // form means this never actually needs `selected` in its closure.
  const toggleRow = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function toggleAll() {
    setSelected((prev) => {
      if (tickets.every((t) => prev.has(t.id)) && tickets.length > 0) return new Set();
      return new Set(tickets.map((t) => t.id));
    });
  }

  // alsoInvalidate mirrors useTickets.ts's useDeleteTicket/useRestoreTicket
  // — only delete (and restore) opt into refreshing ['trash'], since that's
  // the only bulk action that actually moves tickets in/out of it. Sidebar
  // keeps useTrash() mounted at all times for the badge count, so without
  // this a bulk delete left it showing a stale count until something else
  // happened to touch that query.
  function afterBulk(summary: string, alsoInvalidate: unknown[][] = []) {
    setBulkResult(summary);
    setSelected(new Set());
    setReplyOpen(false);
    setAssignOpen(false);
    setBulkBusy(false);
    void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    void queryClient.invalidateQueries({ queryKey: ['ticket-counts'] });
    alsoInvalidate.forEach((key) => void queryClient.invalidateQueries({ queryKey: key }));
  }

  // Bulk REST calls run one-by-one, not Promise.all — nginx rate-limits
  // /api/* per IP (10 r/s), so firing 20+ PATCHes at once gets part of the
  // batch rejected with 429 and reports a misleading partial failure.
  // Sequential keeps every request comfortably under the limit.
  async function runSequentially(ids: string[], op: (id: string) => Promise<unknown>): Promise<number> {
    let failed = 0;
    for (const id of ids) {
      try {
        await op(id);
      } catch {
        failed += 1;
      }
    }
    return failed;
  }

  async function bulkClose() {
    if (isBulkBusy || !closedStatus || !window.confirm(t('ticketModals.closeConfirm', { count: selected.size }))) return;
    setBulkBusy(true);
    const failed = await runSequentially([...selected], (id) => updateTicketStatus(id, closedStatus.id));
    afterBulk(
      failed === 0
        ? t('ticketModals.closedAll', { count: selected.size })
        : t('ticketModals.closedPartial', { done: selected.size - failed, total: selected.size }),
    );
  }

  async function bulkDelete() {
    if (isBulkBusy || !window.confirm(t('ticketModals.deleteConfirm', { count: selected.size }))) return;
    setBulkBusy(true);
    const failed = await runSequentially([...selected], (id) => deleteTicket(id));
    afterBulk(
      failed === 0
        ? t('ticketModals.deletedAll', { count: selected.size })
        : t('ticketModals.deletedPartial', { done: selected.size - failed, total: selected.size }),
      [['trash']],
    );
  }

  async function bulkMerge() {
    if (isBulkBusy) return;
    const selectedTickets = tickets.filter((t) => selected.has(t.id));
    if (selectedTickets.length < 2) return;
    // The oldest ticket becomes the survivor — the rest merge into it, same
    // direction a human doing it by hand one-by-one would pick.
    const target = selectedTickets.reduce((a, b) => (a.createdAt <= b.createdAt ? a : b));
    if (
      !window.confirm(
        t('ticketModals.mergeConfirm', { count: selectedTickets.length, number: target.ticketNumber }),
      )
    ) {
      return;
    }
    setBulkBusy(true);
    let failed = 0;
    for (const ticket of selectedTickets) {
      if (ticket.id === target.id) continue;
      try {
        await mergeTicket(ticket.id, target.id);
      } catch {
        failed += 1;
      }
    }
    const sources = selectedTickets.length - 1;
    afterBulk(
      failed === 0
        ? t('ticketModals.mergedAll', { count: sources, number: target.ticketNumber })
        : t('ticketModals.mergedPartial', { done: sources - failed, total: sources, number: target.ticketNumber }),
    );
  }

  // ===== Column resize (drag the divider at a header's right edge) =====
  const [resizingKey, setResizingKey] = useState<TicketColumnKey | null>(null);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  // A drag is started from a plain mousedown handler, not an effect — it has
  // no React lifecycle hook of its own to clean up after itself. If this
  // page unmounts mid-drag (e.g. a keyboard-triggered navigation while the
  // button is still down), onUp's own cleanup below never runs; this
  // unmount-only effect is the backstop that removes the window listeners
  // either way.
  useEffect(() => {
    return () => resizeCleanupRef.current?.();
  }, []);

  function widthFor(key: TicketColumnKey): number {
    if (key === resizingKey && liveWidth !== null) return liveWidth;
    return columnWidths[key] ?? DEFAULT_WIDTHS[key];
  }

  function startResize(e: React.MouseEvent, key: TicketColumnKey) {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.currentTarget as HTMLElement).closest('th');
    const startWidth = th ? th.getBoundingClientRect().width : 120;
    const startX = e.clientX;
    setResizingKey(key);
    setLiveWidth(startWidth);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    // Only local `liveWidth` state updates on every tick, for the visual
    // drag feedback — the persisted, localStorage-backed table-prefs store
    // is written to exactly once, in onUp, not on every mousemove (this
    // used to serialize and write the whole store on every tick of the
    // drag, tens of times a second).
    let currentWidth = startWidth;
    function onMove(ev: MouseEvent) {
      currentWidth = Math.max(64, startWidth + ev.clientX - startX);
      setLiveWidth(currentWidth);
    }
    function cleanup() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      resizeCleanupRef.current = null;
    }
    function onUp() {
      cleanup();
      setColumnWidth(key, currentWidth);
      setResizingKey(null);
      setLiveWidth(null);
    }
    resizeCleanupRef.current = cleanup;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // "A closed status" for bulk-close, when several isClosed=true rows may
  // exist — same rule as the backend's findClosedForSystemActions: prefer
  // the seeded 'closed' row, fall back to the lowest-sortOrder isClosed row.
  const closedStatus = useMemo(() => {
    if (!statuses) return undefined;
    return (
      statuses.find((s) => s.key === 'closed') ??
      [...statuses].filter((s) => s.isClosed).sort((a, b) => a.sortOrder - b.sortOrder)[0]
    );
  }, [statuses]);

  function statusFolderLabel(statusId: string): string {
    const s = statuses?.find((x) => x.id === statusId);
    if (!s) return statusId;
    return s.key ? t(`ticketStatusFolder.${s.key}`) : pickLocalized(s.name, s.nameUk, s.nameEn, i18n.language);
  }

  const teamMatch = teamId ? teams?.find((tm) => tm.id === teamId) : undefined;
  const teamName = teamMatch ? pickLocalized(teamMatch.name, teamMatch.nameUk, teamMatch.nameEn, i18n.language) : undefined;
  const tagMatch = tagId ? tags?.find((tg) => tg.id === tagId) : undefined;
  const tagName = tagMatch ? pickLocalized(tagMatch.name, tagMatch.nameUk, tagMatch.nameEn, i18n.language) : undefined;
  // assignedTo=unassigned is checked before status — Sidebar's «Неприсвоенные»
  // folder now also carries an explicit &status=open (so a closed-but-
  // unassigned ticket, e.g. auto-closed by automation/SLA, doesn't linger
  // there), and the header must still read «Неприсвоенные», not «В работе».
  // Everything else keeps status ahead of assignedToParam — an operator's
  // status folders carry an implicit ?assignedTo=assigned too, and the
  // header should read «В работе» etc, not «Назначенные мне».
  const title = teamName
    ? teamName
    : tagName
      ? t('tickets.tagLabel', { name: tagName })
      : watching
        ? t('sidebar.watching')
        : mentioned
          ? t('sidebar.mentions')
          : assignedToParam === 'unassigned'
          ? t('sidebar.unassigned')
          : status
            ? statusFolderLabel(status)
            : assignedToParam === 'me'
              ? t('tickets.assignedToMe')
              : t('sidebar.allTickets');
  const totalCount = status ? (counts?.byStatus[status] ?? tickets.length) : (counts?.total ?? tickets.length);

  // Commits the current search-box draft into a URLSearchParams built for a
  // different filter change. Without this, setPriorityFilter/toggleSort
  // build `next` from `searchParams` (the last COMMITTED `q`, not the
  // in-flight `searchDraft`) — their setSearchParams call re-triggers the
  // searchDraft-from-URL sync effect above, which would silently revert the
  // search box to that stale value if the user typed something within the
  // last 350ms and hadn't debounced yet.
  function syncSearchDraftInto(params: URLSearchParams) {
    if (searchDraft.trim()) params.set('q', searchDraft);
    else params.delete('q');
  }

  function setPriorityFilter(value: string) {
    const next = new URLSearchParams(searchParams);
    syncSearchDraftInto(next);
    if (value) {
      next.set('priority', value);
    } else {
      next.delete('priority');
    }
    setSearchParams(next);
  }

  function toggleSort(field: TicketSortField) {
    const next = new URLSearchParams(searchParams);
    syncSearchDraftInto(next);
    if (sortBy === field) {
      next.set('sortOrder', sortOrder === SortOrder.ASC ? SortOrder.DESC : SortOrder.ASC);
    } else {
      next.set('sortBy', field);
      next.set('sortOrder', SortOrder.DESC);
    }
    setSearchParams(next);
  }

  function headerCell(key: TicketColumnKey) {
    const sortField = COLUMN_SORT_FIELDS[key];
    const active = sortField !== undefined && sortBy === sortField;
    return (
      <th key={key} className="relative px-4 py-2.5 font-bold">
        {sortField ? (
          // `uppercase` explicit here, not just inherited from the <tr> —
          // Tailwind's preflight resets text-transform on <button>, so
          // sortable headers would silently fall back to mixed case
          // otherwise while the non-sortable ones (plain <span>) stayed caps.
          <button
            type="button"
            onClick={() => toggleSort(sortField)}
            className={`flex items-center gap-1 uppercase hover:text-ink-muted ${active ? 'text-ink-muted' : ''}`}
          >
            <span className="truncate">{t(COLUMN_LABEL_KEYS[key])}</span>
            <span className="w-2.5 text-[10px]">{active ? (sortOrder === SortOrder.ASC ? '▲' : '▼') : ''}</span>
          </button>
        ) : (
          <span className="truncate">{t(COLUMN_LABEL_KEYS[key])}</span>
        )}
        <span
          role="presentation"
          onMouseDown={(e) => startResize(e, key)}
          className="group absolute -right-1 top-0 z-10 flex h-full w-2 cursor-col-resize items-center justify-center"
        >
          <span
            className={`h-full w-px transition-colors group-hover:bg-brand-600 ${
              resizingKey === key ? 'w-0.5 bg-brand-600' : 'bg-border'
            }`}
          />
        </span>
      </th>
    );
  }

  const bulkButtonClass =
    'rounded-lg border border-border bg-surface-card px-3 py-1.5 text-[12.5px] font-medium text-ink-muted hover:border-brand-600 hover:text-brand-700 disabled:opacity-50';

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-none flex-col gap-2.5 px-4 pb-3.5 pt-4 sm:flex-row sm:items-center sm:gap-3 sm:px-6">
        <div>
          <div className="font-display text-lg font-bold">{title}</div>
          <div className="mt-0.5 text-[12.5px] text-ink-subtle">{t('tickets.count', { count: totalCount })}</div>
        </div>
        <div className="hidden flex-1 sm:block" />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder={t('tickets.searchPlaceholder')}
            className="w-full rounded-lg border border-border bg-surface-card px-3 py-1.5 text-[12.5px] outline-none focus:border-brand-600 sm:w-64"
          />
          <select
            value={priority ?? ''}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-lg border border-border bg-surface-card px-3 py-1.5 text-[12.5px] text-ink-muted outline-none"
          >
            <option value="">{t('tickets.allPriorities')}</option>
            {PRIORITY_FILTER_ORDER.map((value) => (
              <option key={value} value={value}>
                {t(`ticketPriority.${value}`)}
              </option>
            ))}
          </select>
          <button
            ref={savedFiltersButtonRef}
            type="button"
            onClick={() => setSavedFiltersOpen((open) => !open)}
            title={t('tickets.savedFilters')}
            aria-label={t('tickets.savedFilters')}
            className="flex-none rounded-lg border border-border bg-surface-card p-1.5 text-ink-faint hover:border-brand-600 hover:text-brand-600"
          >
            <BookmarkIcon className="h-4 w-4" />
          </button>
          {isSavedFiltersOpen && (
            <SavedFiltersPopover
              anchorRef={savedFiltersButtonRef}
              currentSearch={searchParams.toString()}
              onApply={applyPresetSearch}
              onClose={() => setSavedFiltersOpen(false)}
            />
          )}
        </div>
      </div>

      {someSelected && (
        <div className="mx-4 mb-3 flex flex-none flex-wrap items-center gap-2 rounded-xl border border-brand-600/30 bg-brand-50 px-4 py-2 sm:mx-6">
          <span className="text-[13px] font-semibold text-brand-700">
            {t('tickets.selectedCount', { count: selected.size })}
          </span>
          <button type="button" onClick={() => setReplyOpen(true)} disabled={isBulkBusy} className={bulkButtonClass}>
            {t('tickets.reply')}
          </button>
          <button type="button" onClick={() => setAssignOpen(true)} disabled={isBulkBusy} className={bulkButtonClass}>
            {t('tickets.assign')}
          </button>
          <button
            type="button"
            onClick={() => void bulkMerge()}
            disabled={isBulkBusy || tickets.filter((row) => selected.has(row.id)).length < 2}
            title={t('tickets.mergeHint')}
            className={bulkButtonClass}
          >
            {t('tickets.merge')}
          </button>
          <button
            type="button"
            onClick={() => void bulkClose()}
            disabled={isBulkBusy || !closedStatus}
            className={bulkButtonClass}
          >
            {t('common.close')}
          </button>
          <button
            type="button"
            onClick={() => void bulkDelete()}
            disabled={isBulkBusy}
            className="rounded-lg border border-border bg-surface-card px-3 py-1.5 text-[12.5px] font-medium text-priority-urgent hover:border-priority-urgent disabled:opacity-50"
          >
            {t('tickets.delete')}
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-[12.5px] font-medium text-ink-subtle hover:text-ink"
          >
            ✕ {t('tickets.clearSelection')}
          </button>
        </div>
      )}

      {bulkResult && (
        <div className="mx-4 mb-3 flex flex-none flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-card px-4 py-2 text-[13px] text-ink-muted sm:mx-6">
          <span className="min-w-0 flex-1">{bulkResult}</span>
          <button
            type="button"
            onClick={() => setBulkResult(null)}
            aria-label={t('tickets.dismiss')}
            className="text-ink-faint hover:text-ink"
          >
            ✕
          </button>
        </div>
      )}

      <div ref={listContainerRef} className="flex-1 overflow-auto px-4 pb-6 sm:px-6">
        {isLoading && <div className="py-16 text-center text-sm text-ink-subtle">{t('common.loading')}</div>}
        {isError && (
          <div className="py-16 text-center text-sm text-priority-urgent">{t('tickets.loadError')}</div>
        )}

        {!isLoading && !isError && tickets.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface-card py-16 text-center">
            <div className="font-display text-sm font-semibold text-ink-muted">{t('tickets.emptyTitle')}</div>
            <div className="mt-1 text-[13px] text-ink-faint">
              {search ? t('tickets.emptySearchHint') : t('tickets.emptyFilterHint')}
            </div>
          </div>
        )}

        {tickets.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface-card">
            <table
              className="table-fixed text-left"
              style={{
                // Exact sum of declared column widths, never 100%/min-width —
                // any slack that would force the browser to redistribute
                // extra space across columns re-couples their widths to each
                // other. Narrower-than-card just leaves blank space to the
                // right; wider triggers the wrapper's horizontal scrollbar.
                width: 64 + visibleColumns.reduce((sum, key) => sum + widthFor(key), 0),
              }}
            >
              <colgroup>
                <col style={{ width: 64 }} />
                {visibleColumns.map((key) => (
                  <col key={key} style={{ width: widthFor(key) }} />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="relative px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        aria-label={t('tickets.selectAll')}
                        checked={allOnPageSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected && !allOnPageSelected;
                        }}
                        onChange={toggleAll}
                      />
                      <button
                        ref={columnsButtonRef}
                        type="button"
                        onClick={() => setColumnsOpen((open) => !open)}
                        title={t('tickets.columnsAndOrder')}
                        aria-label={t('tickets.configureColumns')}
                        className="text-ink-faint hover:text-brand-600"
                      >
                        <GearIcon className="h-4 w-4" />
                      </button>
                    </div>
                    {isColumnsOpen && (
                      <ColumnSettingsPopover anchorRef={columnsButtonRef} onClose={() => setColumnsOpen(false)} />
                    )}
                  </th>
                  {visibleColumns.map((key) => headerCell(key))}
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <TicketRow
                    key={ticket.id}
                    ticket={ticket}
                    visibleColumns={visibleColumns}
                    isRecent={activeTicketIds.includes(ticket.id)}
                    isSelected={selected.has(ticket.id)}
                    lookupUser={lookupUser}
                    isVip={isVip}
                    teams={teams}
                    slaPolicies={slaPolicies}
                    onToggle={toggleRow}
                    navigate={navigate}
                  />
                ))}
              </tbody>
            </table>
            <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle px-4 py-2.5">
              <span className="text-[12.5px] text-ink-faint">
                {t('tickets.pageRange', {
                  from: pageIndex * pageSize + 1,
                  to: pageIndex * pageSize + tickets.length,
                  total: totalCount,
                })}
              </span>
              <div className="flex-1" />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={goToPrevPage}
                  disabled={!hasPrevPage || isFetching}
                  className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-40"
                >
                  {t('tickets.prevPage')}
                </button>
                <button
                  type="button"
                  onClick={goToNextPage}
                  disabled={!hasNextPage || isFetching}
                  className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-40"
                >
                  {t('tickets.nextPage')}
                </button>
              </div>
              <label className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
                {t('tickets.pageSizeLabel')}
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])}
                  className="rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[12.5px] text-ink-muted outline-none"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}
      </div>

      {isReplyOpen && <BulkReplyModal ticketIds={[...selected]} onDone={afterBulk} onClose={() => setReplyOpen(false)} />}
      {isAssignOpen && <BulkAssignModal ticketIds={[...selected]} onDone={afterBulk} onClose={() => setAssignOpen(false)} />}
    </div>
  );
}
