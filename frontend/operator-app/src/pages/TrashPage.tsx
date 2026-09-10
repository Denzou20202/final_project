import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '../components/common/Checkbox.js';
import { PriorityBadge } from '../components/tickets/PriorityBadge.js';
import { StatusBadge } from '../components/tickets/StatusBadge.js';
import { useTrash } from '../hooks/useTickets.js';
import { hardDeleteTicket, restoreTicket } from '../lib/api/tickets.api.js';
import { formatDateTime } from '../lib/format.js';

export default function TrashPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: trash, isLoading } = useTrash();
  const tickets = trash ?? [];

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isBulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  const allSelected = tickets.length > 0 && tickets.every((ticket) => selected.has(ticket.id));
  const someSelected = selected.size > 0;

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (tickets.length > 0 && tickets.every((t) => prev.has(t.id)) ? new Set() : new Set(tickets.map((t) => t.id))));
  }

  function afterBulk(summary: string) {
    setBulkResult(summary);
    setSelected(new Set());
    setBulkBusy(false);
    void queryClient.invalidateQueries({ queryKey: ['trash'] });
    void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    void queryClient.invalidateQueries({ queryKey: ['ticket-counts'] });
  }

  // Sequential, not Promise.all — same reasoning as TicketsPage's bulk
  // actions: nginx rate-limits /api/* per IP (10 r/s), so firing many
  // requests at once risks part of the batch coming back 429.
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

  async function bulkRestore() {
    if (isBulkBusy) return;
    setBulkBusy(true);
    const ids = [...selected];
    const failed = await runSequentially(ids, (id) => restoreTicket(id));
    afterBulk(
      failed === 0
        ? t('trash.restoredAll', { count: ids.length })
        : t('trash.restoredPartial', { done: ids.length - failed, total: ids.length }),
    );
  }

  async function bulkHardDelete() {
    if (isBulkBusy || !window.confirm(t('trash.deletePermanentlyConfirm', { count: selected.size }))) return;
    setBulkBusy(true);
    const ids = [...selected];
    const failed = await runSequentially(ids, (id) => hardDeleteTicket(id));
    afterBulk(
      failed === 0
        ? t('trash.deletedPermanentlyAll', { count: ids.length })
        : t('trash.deletedPermanentlyPartial', { done: ids.length - failed, total: ids.length }),
    );
  }

  const bulkButtonClass =
    'rounded-lg border border-border bg-surface-card px-3 py-1.5 text-[12.5px] font-medium text-ink-muted hover:border-brand-600 hover:text-brand-700 disabled:opacity-50';

  return (
    <div className="flex h-full flex-col">
      <div className="flex-none px-6 pb-3.5 pt-4">
        <div className="font-display text-lg font-bold">{t('sidebar.trash')}</div>
        <div className="mt-0.5 text-[12.5px] text-ink-subtle">{t('trash.subtitle')}</div>
      </div>

      {someSelected && (
        <div className="mx-6 mb-3 flex flex-none flex-wrap items-center gap-2 rounded-xl border border-brand-600/30 bg-brand-50 px-4 py-2">
          <span className="text-[13px] font-semibold text-brand-700">
            {t('tickets.selectedCount', { count: selected.size })}
          </span>
          <button type="button" onClick={() => void bulkRestore()} disabled={isBulkBusy} className={bulkButtonClass}>
            {t('trash.restore')}
          </button>
          <button
            type="button"
            onClick={() => void bulkHardDelete()}
            disabled={isBulkBusy}
            className="rounded-lg border border-border bg-surface-card px-3 py-1.5 text-[12.5px] font-medium text-priority-urgent hover:border-priority-urgent disabled:opacity-50"
          >
            {t('trash.deletePermanently')}
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
        <div className="mx-6 mb-3 flex flex-none flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-card px-4 py-2 text-[13px] text-ink-muted">
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

      <div className="flex-1 overflow-auto px-6 pb-6">
        {isLoading && <div className="py-16 text-center text-sm text-ink-subtle">{t('common.loading')}</div>}

        {!isLoading && tickets.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface-card py-16 text-center">
            <div className="font-display text-sm font-semibold text-ink-muted">{t('trash.empty')}</div>
          </div>
        )}

        {!isLoading && tickets.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface-card">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2.5">
                    <Checkbox aria-label={t('tickets.selectAll')} checked={allSelected} onChange={toggleAll} />
                  </th>
                  <th className="px-4 py-2.5 font-bold">{t('tickets.columnNumber')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('tickets.columnTitle')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('tickets.columnStatus')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('tickets.columnPriority')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('trash.columnDeleted')}</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => navigate(`/tickets/${ticket.id}`)}
                    className={`cursor-pointer border-b border-border-subtle text-[13.5px] last:border-0 hover:bg-surface-muted ${
                      selected.has(ticket.id) ? 'bg-brand-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        aria-label={t('tickets.selectRow', { number: ticket.ticketNumber })}
                        checked={selected.has(ticket.id)}
                        onChange={() => toggleRow(ticket.id)}
                      />
                    </td>
                    <td className="px-4 py-3 text-ink-faint">#{ticket.ticketNumber}</td>
                    <td className="max-w-xs truncate px-4 py-3 font-medium">
                      <Link
                        to={`/tickets/${ticket.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-brand-600 hover:underline"
                      >
                        {ticket.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ticket.status} unassigned={!ticket.assignedTo} />
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={ticket.priority} />
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {ticket.deletedAt ? formatDateTime(ticket.deletedAt, i18n.language) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
