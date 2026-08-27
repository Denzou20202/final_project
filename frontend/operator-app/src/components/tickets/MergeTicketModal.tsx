import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMergeTicket } from '../../hooks/useTickets.js';
import { fetchTicketByNumber } from '../../lib/api/tickets.api.js';
import { getErrorMessage } from '../../lib/errors.js';
import type { PublicTicket } from '../../lib/types.js';
import { StatusBadge } from './StatusBadge.js';

export function MergeTicketModal({ ticket, onClose }: { ticket: PublicTicket; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const mergeTicket = useMergeTicket();
  const [numberInput, setNumberInput] = useState('');
  const [target, setTarget] = useState<PublicTicket | null>(null);
  const [lookupError, setLookupError] = useState<string | undefined>();
  const [isLooking, setLooking] = useState(false);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(numberInput);
    if (!Number.isInteger(n) || n <= 0) {
      setLookupError(t('ticketModals.numberRequired'));
      return;
    }
    setLooking(true);
    setLookupError(undefined);
    setTarget(null);
    try {
      const found = await fetchTicketByNumber(n);
      if (found.id === ticket.id) {
        setLookupError(t('ticketModals.cannotMergeSelf'));
        return;
      }
      if (found.mergedIntoId) {
        setLookupError(t('ticketModals.alreadyMerged'));
        return;
      }
      setTarget(found);
    } catch (err) {
      setLookupError(getErrorMessage(err, t('ticketDetail.notFound')));
    } finally {
      setLooking(false);
    }
  }

  function handleConfirm() {
    if (!target) return;
    mergeTicket.mutate(
      { id: ticket.id, args: [target.id] },
      {
        onSuccess: () => {
          onClose();
          navigate(`/tickets/${target.id}`);
        },
      },
    );
  }

  const mergeError = mergeTicket.error ? getErrorMessage(mergeTicket.error) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="h-full w-full overflow-y-auto bg-surface-card p-6 shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl sm:border sm:border-border">
        <h2 className="mb-1 font-display text-base font-bold">{t('ticketModals.mergeTitle')}</h2>
        <p className="mb-4 text-[12.5px] text-ink-subtle">
          {t('ticketModals.mergeSubtitle', { number: ticket.ticketNumber })}
        </p>

        <form onSubmit={handleLookup} className="flex gap-2" noValidate>
          <input
            value={numberInput}
            onChange={(e) => setNumberInput(e.target.value)}
            placeholder={t('ticketModals.ticketNumberPlaceholder')}
            inputMode="numeric"
            className="flex-1 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
          />
          <button
            type="submit"
            disabled={isLooking}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-50"
          >
            {isLooking ? t('ticketModals.searching') : t('ticketModals.find')}
          </button>
        </form>
        {lookupError && <p className="mt-2 text-xs text-priority-urgent">{lookupError}</p>}

        {target && (
          <div className="mt-3 rounded-lg border border-border bg-surface-card p-3">
            <div className="flex items-center gap-1.5 text-[13px]">
              <span className="text-ink-faint">#{target.ticketNumber}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{target.title}</span>
              <StatusBadge status={target.status} unassigned={!target.assignedTo} />
            </div>
          </div>
        )}

        {mergeError && (
          <p className="mt-3 rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{mergeError}</p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!target || mergeTicket.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {mergeTicket.isPending ? t('ticketModals.merging') : t('tickets.merge')}
          </button>
        </div>
      </div>
    </div>
  );
}
