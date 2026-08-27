import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CloseIcon } from '../common/icons.js';
import { useTeams } from '../../hooks/useTeams.js';
import { useTicketsList } from '../../hooks/useTickets.js';
import { useUserLookup } from '../../hooks/useUserLookup.js';
import { useAssignableUsers } from '../../hooks/useUsers.js';
import { endOfLocalDay, formatDateTime, startOfLocalDay } from '../../lib/format.js';
import { pickLocalized } from '../../lib/localized.js';
import { PriorityBadge } from './PriorityBadge.js';
import { StatusBadge } from './StatusBadge.js';

// A searchable/filterable browser over one client's full ticket history —
// was a small inline "other tickets" list capped at 10, capped implicitly
// by whatever useClientTicketHistory happened to fetch. Reuses
// useTicketsList (the same paginated hook TicketsPage itself uses) with
// createdBy locked to this client, so pagination/sorting come for free.
export function ClientHistoryModal({
  clientId,
  excludeTicketId,
  onClose,
}: {
  clientId: string;
  excludeTicketId?: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [teamId, setTeamId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data: teams } = useTeams();
  const { data: usersPage } = useAssignableUsers();
  const lookupUser = useUserLookup();
  const staff = (usersPage?.items ?? []).filter((u) => u.role !== 'client' && !u.deactivatedAt);

  // Same debounce TicketsPage's search box uses — typing stays instant, the
  // actual query fires once after a short pause instead of per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchDraft.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  const filters = useMemo(
    () => ({
      createdBy: clientId,
      search: search || undefined,
      teamId: teamId || undefined,
      assignedTo: assignedTo || undefined,
      createdFrom: from ? startOfLocalDay(from).toISOString() : undefined,
      createdTo: to ? endOfLocalDay(to).toISOString() : undefined,
    }),
    [clientId, search, teamId, assignedTo, from, to],
  );

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useTicketsList(filters);
  const tickets = (data?.pages.flatMap((page) => page.items) ?? []).filter((ticket) => ticket.id !== excludeTicketId);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-surface-card shadow-lg sm:h-[85vh] sm:w-[85vw] sm:rounded-2xl sm:border sm:border-border">
        <div className="flex flex-none items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-display text-base font-bold">{t('ticketDetail.clientHistory')}</h2>
          <button
            type="button"
            onClick={onClose}
            title={t('common.close')}
            aria-label={t('common.close')}
            className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-muted hover:text-priority-urgent"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-none flex-wrap items-end gap-3 border-b border-border px-5 py-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
              {t('clientHistory.searchLabel')}
            </label>
            <input
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder={t('clientHistory.searchPlaceholder')}
              className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
              {t('ticketFields.team')}
            </label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-600"
            >
              <option value="">{t('reports.all')}</option>
              {(teams ?? []).map((team) => (
                <option key={team.id} value={team.id}>
                  {pickLocalized(team.name, team.nameUk, team.nameEn, i18n.language)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
              {t('ticketFields.assignee')}
            </label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-600"
            >
              <option value="">{t('reports.all')}</option>
              {staff.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
              {t('reports.fromLabel')}
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
              {t('reports.toLabel')}
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-600"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading && <div className="py-10 text-center text-[13px] text-ink-subtle">{t('common.loading')}</div>}

          {!isLoading && tickets.length === 0 && (
            <div className="py-10 text-center text-[13px] text-ink-faint">{t('clientHistory.empty')}</div>
          )}

          {tickets.length > 0 && (
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-surface-card">
                <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-2.5 font-bold">{t('tickets.columnNumber')}</th>
                  <th className="px-5 py-2.5 font-bold">{t('tickets.columnTitle')}</th>
                  <th className="px-5 py-2.5 font-bold">{t('tickets.columnStatus')}</th>
                  <th className="px-5 py-2.5 font-bold">{t('tickets.columnPriority')}</th>
                  <th className="px-5 py-2.5 font-bold">{t('ticketFields.team')}</th>
                  <th className="px-5 py-2.5 font-bold">{t('ticketFields.assignee')}</th>
                  <th className="px-5 py-2.5 font-bold">{t('tickets.columnCreatedAt')}</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-border-subtle text-[13.5px] last:border-0">
                    <td className="px-5 py-3 text-ink-faint">
                      <Link to={`/tickets/${ticket.id}`} onClick={onClose} className="hover:text-brand-600 hover:underline">
                        #{ticket.ticketNumber}
                      </Link>
                    </td>
                    <td className="max-w-xs truncate px-5 py-3 font-medium">
                      <Link to={`/tickets/${ticket.id}`} onClick={onClose} className="hover:text-brand-600 hover:underline">
                        {ticket.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={ticket.status} unassigned={!ticket.assignedTo} />
                    </td>
                    <td className="px-5 py-3">
                      <PriorityBadge priority={ticket.priority} />
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      {(() => {
                        const team = ticket.teamId ? teams?.find((tm) => tm.id === ticket.teamId) : undefined;
                        return team ? pickLocalized(team.name, team.nameUk, team.nameEn, i18n.language) : '—';
                      })()}
                    </td>
                    <td className="px-5 py-3 text-ink-muted">{lookupUser(ticket.assignedTo)}</td>
                    <td className="px-5 py-3 text-ink-muted">{formatDateTime(ticket.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {hasNextPage && (
            <div className="py-4 text-center">
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-50"
              >
                {isFetchingNextPage ? t('common.loading') : t('tickets.loadMore')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
