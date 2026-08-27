import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChatPanel } from '../components/chat/ChatPanel.js';
import { PriorityBadge } from '../components/tickets/PriorityBadge.js';
import { StatusBadge } from '../components/tickets/StatusBadge.js';
import { TicketActionsPanel } from '../components/tickets/TicketActionsPanel.js';
import { TicketAttributesPanel } from '../components/tickets/TicketAttributesPanel.js';
import { useTicket, useTicketActivity } from '../hooks/useTickets.js';
import { useRecentActivityStore } from '../store/recent-activity.store.js';

export default function TicketDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { ticketId } = useParams<{ ticketId: string }>();
  const { data: ticket, isLoading, isError } = useTicket(ticketId);
  const { data: activity } = useTicketActivity(ticketId);
  const clearRecentActivity = useRecentActivityStore((s) => s.clear);

  // Opening a ticket is what "seeing" it means for the highlight in the
  // list — clear its unseen-activity flag regardless of whether it was
  // actually set, cheaper than checking first.
  useEffect(() => {
    if (ticketId) clearRecentActivity(ticketId);
  }, [ticketId, clearRecentActivity]);

  // A merged-away ticket is a dead end (frozen, its own content moved to
  // the target) — land here from a stale link/bookmark/search hit and get
  // bounced straight to the ticket that's actually current, rather than a
  // banner the person has to notice and click themselves.
  const mergedIntoId = ticket?.mergedIntoId;
  useEffect(() => {
    if (mergedIntoId) navigate(`/tickets/${mergedIntoId}`, { replace: true });
  }, [mergedIntoId, navigate]);

  if (isLoading || mergedIntoId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-ink-subtle">
        {mergedIntoId ? t('ticketDetail.mergedNotice') : t('common.loading')}
      </div>
    );
  }
  if (isError || !ticket) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm">
        <div className="text-priority-urgent">{t('ticketDetail.notFound')}</div>
        <Link to="/tickets" className="text-brand-600 hover:underline">
          {t('ticketDetail.backToAll')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <TicketActionsPanel ticket={ticket} activity={activity} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-none border-b border-border bg-surface-card px-6 py-3.5">
          <Link to="/tickets" className="text-[12px] text-ink-subtle hover:text-brand-600">
            ← {t('ticketDetail.backToAll')}
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <span className="text-[12.5px] font-medium text-ink-faint">#{ticket.ticketNumber}</span>
            <h1 className="min-w-0 truncate font-display text-base font-bold" title={ticket.title}>
              {ticket.title}
            </h1>
            <StatusBadge status={ticket.status} unassigned={!ticket.assignedTo} />
            <PriorityBadge priority={ticket.priority} />
          </div>
        </div>

        <div className="min-h-0 flex-1">
          {/* key forces a remount on ticket switch — without it React reuses
              the same ChatPanel instance across `:ticketId` changes (only the
              route param differs), so the Tiptap editor and composer state
              (staged files, in-progress edit, send error) leaked from the
              previous ticket into the next one. */}
          <ChatPanel
            key={ticket.id}
            ticketId={ticket.id}
            clientId={ticket.createdBy}
            ticketNumber={ticket.ticketNumber}
            isClosed={ticket.status.isClosed}
            isDeleted={!!ticket.deletedAt}
          />
        </div>
      </div>

      <TicketAttributesPanel ticket={ticket} />
    </div>
  );
}
