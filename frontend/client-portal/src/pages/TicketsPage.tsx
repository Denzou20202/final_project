import { SortOrder, TicketSortField } from '@veloxdesk/types';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { COLUMN_LABEL_KEYS, ColumnSettingsPopover } from '../components/tickets/ColumnSettingsPopover.js';
import { GearIcon } from '../components/common/icons.js';
import { PriorityBadge } from '../components/tickets/PriorityBadge.js';
import { StatusBadge } from '../components/tickets/StatusBadge.js';
import { useTicketCounts, useTicketsPage } from '../hooks/useTickets.js';
import { useTicketStatuses } from '../hooks/useTicketStatuses.js';
import { toIntlLocale } from '../lib/format.js';
import { resolveStatusIdParam } from '../lib/status-url.js';
import type { PublicTicket } from '../lib/types.js';
import { useRecentActivityStore } from '../store/recent-activity.store.js';
import { useSidebarHighlightStore } from '../store/sidebar-highlight.store.js';
import { PAGE_SIZE_OPTIONS, useTicketTableStore, type TicketColumnKey } from '../store/ticket-table.store.js';

const COLUMN_SORT_FIELDS: Partial<Record<TicketColumnKey, TicketSortField>> = {
  number: TicketSortField.TICKET_NUMBER,
  title: TicketSortField.TITLE,
  status: TicketSortField.STATUS,
  priority: TicketSortField.PRIORITY,
  createdAt: TicketSortField.CREATED_AT,
};

function formatDate(iso: string, language: string): string {
  return new Date(iso).toLocaleString(toIntlLocale(language), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function bodyCell(key: TicketColumnKey, ticket: PublicTicket, isRecent: boolean, language: string) {
  switch (key) {
    case 'number':
      return (
        <td key={key} className="px-4 py-3 text-ink-faint">
          <span className="flex items-center gap-1.5">
            {isRecent && <span className="h-1.5 w-1.5 flex-none rounded-full bg-brand-600" />}#{ticket.ticketNumber}
          </span>
        </td>
      );
    case 'title':
      return (
        <td key={key} className={`max-w-xs truncate px-4 py-3 ${isRecent ? 'font-bold' : 'font-medium'}`}>
          {ticket.title}
        </td>
      );
    case 'status':
      return (
        <td key={key} className="px-4 py-3">
          <StatusBadge status={ticket.status} unassigned={!ticket.assignedTo} />
        </td>
      );
    case 'priority':
      return (
        <td key={key} className="px-4 py-3">
          <PriorityBadge priority={ticket.priority} />
        </td>
      );
    case 'createdAt':
      return (
        <td key={key} className="px-4 py-3 text-ink-subtle">
          {formatDate(ticket.createdAt, language)}
        </td>
      );
  }
}

export default function TicketsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTicketIds = useRecentActivityStore((s) => s.activeTicketIds);

  const columnOrder = useTicketTableStore((s) => s.order);
  const pageSize = useTicketTableStore((s) => s.pageSize);
  const setPageSize = useTicketTableStore((s) => s.setPageSize);
  const [isColumnsOpen, setColumnsOpen] = useState(false);
  const columnsButtonRef = useRef<HTMLButtonElement>(null);

  const { data: statuses } = useTicketStatuses();
  const status = resolveStatusIdParam(searchParams.get('statusId'), statuses);
  const assignedTo = searchParams.get('assignedTo') ?? undefined;
  const isUnassignedFolder = assignedTo === 'unassigned';
  const clearFolderHighlight = useSidebarHighlightStore((s) => s.clear);
  const clearUnassignedHighlight = useSidebarHighlightStore((s) => s.clearUnassigned);
  useEffect(() => {
    if (isUnassignedFolder) clearUnassignedHighlight();
    else if (status) clearFolderHighlight(status);
  }, [status, isUnassignedFolder, clearFolderHighlight, clearUnassignedHighlight]);
  const watching = searchParams.get('watching') === 'me' ? ('me' as const) : undefined;
  const rawSearch = searchParams.get('q');
  const search = rawSearch?.trim() ? rawSearch : undefined;
  const sortBy = (searchParams.get('sortBy') as TicketSortField | null) ?? TicketSortField.CREATED_AT;
  const sortOrder = (searchParams.get('sortOrder') as SortOrder | null) ?? SortOrder.DESC;

  // The draft is local so typing stays instant; the URL (and with it the
  // actual query) updates after a short pause, and lands in history as
  // replace so Back doesn't step through every keystroke. Mirrors
  // operator-app's identical search box.
  const [searchDraft, setSearchDraft] = useState(searchParams.get('q') ?? '');
  // Sync the draft FROM the URL for any change this input itself didn't
  // cause — clicking the Logo (navigate('/tickets')) rewrites `q` without
  // touching this local state. Without this, the box kept showing stale
  // text after such a navigation, and the debounce effect below would even
  // write that stale text straight back into the "cleared" URL, so the logo
  // never actually landed on the unfiltered ticket list.
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
    () => ({ statusId: status ?? undefined, assignedTo, watching, search, sortBy, sortOrder, limit: pageSize }),
    [status, assignedTo, watching, search, sortBy, sortOrder, pageSize],
  );

  // Real pagination (not "load more") — pageCursors[i] is the cursor that
  // fetches page i (index 0), so Prev never needs to re-derive anything, it
  // just steps back to an already-known index. Every filter/pageSize change
  // must restart at page 1 — a cursor from the old filter set is meaningless
  // against the new one. Mirrors operator-app's TicketsPage exactly.
  const [pageCursors, setPageCursors] = useState<(string | undefined)[]>([undefined]);
  const [pageIndex, setPageIndex] = useState(0);
  const listContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setPageCursors([undefined]);
    setPageIndex(0);
    listContainerRef.current?.scrollTo({ top: 0 });
  }, [status, assignedTo, watching, search, sortBy, sortOrder, pageSize]);

  const { data, isLoading, isError, isFetching } = useTicketsPage(filters, pageCursors[pageIndex]);
  const { data: counts } = useTicketCounts({ watching, search, assignedTo });
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
    listContainerRef.current?.scrollTo({ top: 0 });
  }

  function goToPrevPage() {
    setPageIndex((i) => Math.max(0, i - 1));
    listContainerRef.current?.scrollTo({ top: 0 });
  }

  const activeStatus = status ? statuses?.find((s) => s.id === status) : undefined;
  const title = watching
    ? t('sidebar.watching')
    : isUnassignedFolder
      ? t('ticketStatusFolder.unassigned')
      : status
        ? (activeStatus?.key ? t(`ticketStatusFolder.${activeStatus.key}`) : (activeStatus?.name ?? status))
        : t('sidebar.allTickets');
  const totalCount = status ? (counts?.byStatus[status] ?? tickets.length) : (counts?.total ?? tickets.length);

  function toggleSort(field: TicketSortField) {
    const next = new URLSearchParams(searchParams);
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
      <th key={key} className="px-4 py-2.5 font-bold">
        {sortField ? (
          // `uppercase` explicit here, not just inherited from the <tr> —
          // Tailwind's preflight resets text-transform on <button>, so this
          // would otherwise silently render in mixed case.
          <button
            type="button"
            onClick={() => toggleSort(sortField)}
            className={`flex items-center gap-1 uppercase hover:text-ink-muted ${active ? 'text-ink-muted' : ''}`}
          >
            {t(COLUMN_LABEL_KEYS[key])}
            <span className="w-2.5 text-[10px]">{active ? (sortOrder === SortOrder.ASC ? '▲' : '▼') : ''}</span>
          </button>
        ) : (
          t(COLUMN_LABEL_KEYS[key])
        )}
      </th>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-none flex-col gap-2.5 px-4 pb-3.5 pt-4 sm:flex-row sm:items-center sm:gap-3 sm:px-6">
        <div>
          <div className="font-display text-lg font-bold">{title}</div>
          <div className="mt-0.5 text-[12.5px] text-ink-subtle">{t('tickets.count', { count: totalCount })}</div>
        </div>
        <div className="hidden flex-1 sm:block" />
        <input
          type="search"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder={t('tickets.searchPlaceholder')}
          className="w-full rounded-lg border border-border bg-surface-card px-3 py-1.5 text-[12.5px] outline-none focus:border-brand-600 sm:w-64"
        />
      </div>

      <div ref={listContainerRef} className="flex-1 overflow-auto px-4 pb-6 sm:px-6">
        {isLoading && <div className="py-16 text-center text-sm text-ink-subtle">{t('common.loading')}</div>}
        {isError && (
          <div className="py-16 text-center text-sm text-priority-urgent">{t('tickets.loadError')}</div>
        )}

        {!isLoading && !isError && tickets.length === 0 && !status && !watching && !search && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface-card py-16 text-center">
            <div className="font-display text-sm font-semibold text-ink-muted">{t('tickets.emptyNoTicketsTitle')}</div>
            <div className="mt-1 text-[13px] text-ink-faint">{t('tickets.emptyNoTicketsHint')}</div>
            <button
              type="button"
              onClick={() => navigate('/tickets/new')}
              className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover"
            >
              {t('sidebar.newTicket')}
            </button>
          </div>
        )}

        {!isLoading && !isError && tickets.length === 0 && (status || watching || search) && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface-card py-16 text-center">
            <div className="font-display text-sm font-semibold text-ink-muted">{t('tickets.emptyFilteredTitle')}</div>
            <div className="mt-1 text-[13px] text-ink-faint">{t('tickets.emptyFilteredHint')}</div>
          </div>
        )}

        {tickets.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface-card">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="relative px-3 py-2.5">
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
                    {isColumnsOpen && (
                      <ColumnSettingsPopover anchorRef={columnsButtonRef} onClose={() => setColumnsOpen(false)} />
                    )}
                  </th>
                  {columnOrder.map((key) => headerCell(key))}
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => {
                  const isRecent = activeTicketIds.includes(ticket.id);
                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      className={`cursor-pointer border-b border-border-subtle text-[13.5px] last:border-0 hover:bg-surface-muted ${
                        isRecent ? 'bg-brand-50/60' : ''
                      }`}
                    >
                      <td className="px-3 py-3" />
                      {columnOrder.map((key) => bodyCell(key, ticket, isRecent, i18n.language))}
                    </tr>
                  );
                })}
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
    </div>
  );
}
