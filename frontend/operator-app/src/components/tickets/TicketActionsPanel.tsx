import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  useDeleteTicket,
  useSendStatusEmail,
  useUnwatchTicket,
  useWatchStatus,
  useWatchTicket,
} from '../../hooks/useTickets.js';
import { exportTicket } from '../../lib/api/tickets.api.js';
import { getErrorMessage } from '../../lib/errors.js';
import { useUserLookup } from '../../hooks/useUserLookup.js';
import { GlobeIcon, MailIcon, TelegramIcon } from '../common/icons.js';
import { VipBadge } from '../common/VipBadge.js';
import { useAssignableUsers } from '../../hooks/useUsers.js';
import type { PublicTicket, PublicTicketActivity } from '../../lib/types.js';
import { ClientHistoryModal } from './ClientHistoryModal.js';
import { MergeTicketModal } from './MergeTicketModal.js';
import { TicketAuditModal } from './TicketAuditModal.js';

// TicketChannel → icon + i18n label, used just above the client-history
// button. Falls back to the globe/"Веб-приложение" case for any value this
// component doesn't recognize (there's no "unknown channel" state today,
// but a future channel that shows up here before this file is updated
// should read as "the ordinary way," not render nothing).
const CHANNEL_META: Record<string, { Icon: typeof GlobeIcon; labelKey: string }> = {
  telegram: { Icon: TelegramIcon, labelKey: 'ticketDetail.channelTelegram' },
  email: { Icon: MailIcon, labelKey: 'ticketDetail.channelEmail' },
  portal: { Icon: GlobeIcon, labelKey: 'ticketDetail.channelPortal' },
};

function ActionButton({
  label,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-[12.5px] font-medium disabled:opacity-50 ${
        danger
          ? 'border-priority-urgent/30 text-priority-urgent hover:bg-priority-urgent/5'
          : 'border-border text-ink-muted hover:bg-surface-card'
      }`}
    >
      {label}
    </button>
  );
}

export function TicketActionsPanel({
  ticket,
  activity,
}: {
  ticket: PublicTicket;
  activity: PublicTicketActivity[] | undefined;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const lookupUser = useUserLookup();
  const { data: usersPage } = useAssignableUsers();
  const client = usersPage?.items.find((u) => u.id === ticket.createdBy);
  const { data: watchStatus } = useWatchStatus(ticket.id);
  const watch = useWatchTicket();
  const unwatch = useUnwatchTicket();
  const sendStatusEmail = useSendStatusEmail();
  const deleteTicket = useDeleteTicket();
  const [isMergeModalOpen, setMergeModalOpen] = useState(false);
  const [isExporting, setExporting] = useState(false);
  const [isAuditOpen, setAuditOpen] = useState(false);
  const [isClientHistoryOpen, setClientHistoryOpen] = useState(false);

  // Viewing a trashed ticket works, but every mutation here still 404s
  // until it's restored (see the "Восстановить" button on
  // TicketAttributesPanel) — disabled to match instead of failing silently.
  const isDeleted = !!ticket.deletedAt;

  async function handleExport() {
    setExporting(true);
    try {
      await exportTicket(ticket.id, ticket.ticketNumber);
    } finally {
      setExporting(false);
    }
  }

  function handleSendStatus() {
    if (!window.confirm(t('ticketDetail.sendStatusConfirm', { status: t(`ticketStatus.${ticket.status}`) }))) return;
    sendStatusEmail.mutate({ id: ticket.id, args: [] });
  }

  function handleDelete() {
    if (!window.confirm(t('ticketDetail.deleteConfirm'))) return;
    deleteTicket.mutate(
      { id: ticket.id, args: [] },
      { onSuccess: () => navigate('/tickets') },
    );
  }

  const deleteError = deleteTicket.error ? getErrorMessage(deleteTicket.error) : undefined;

  return (
    <aside className="flex w-72 flex-none flex-col overflow-y-auto border-r border-border bg-surface-sidebar">
      <div className="border-b border-border p-4">
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{t('ticketDetail.client')}</div>
        <div className="flex items-center gap-1.5 text-[13.5px] font-medium">
          {lookupUser(ticket.createdBy)}
          {client?.isVip && <VipBadge />}
        </div>
        {ticket.createdOnBehalfBy && (
          <div className="mt-0.5 text-[11.5px] text-ink-faint">
            {t('ticketDetail.createdOnBehalf', { name: lookupUser(ticket.createdOnBehalfBy) })}
          </div>
        )}
        {/* Organizational context entered by an admin on the Пользователи
            page — only rendered when actually filled in, so a client who
            hasn't been enriched yet doesn't get a wall of empty rows. */}
        {client && (
          <dl className="mt-2 flex flex-col gap-1 text-[12.5px]">
            {(
              [
                ['computerName', client.computerName],
                ['position', client.position],
                ['department', client.department],
                ['company', client.company],
                ['city', client.city],
                ['phone', client.phone],
              ] as const
            )
              .filter(([, value]) => !!value)
              .map(([key, value]) => (
                <div key={key} className="flex gap-1.5">
                  <dt className="flex-none text-ink-faint">{t(`ticketDetail.${key}`)}:</dt>
                  <dd className="min-w-0 truncate text-ink-muted">{value}</dd>
                </div>
              ))}
          </dl>
        )}
      </div>

      <div className="border-b border-border p-4">
        {(() => {
          const { Icon, labelKey } = CHANNEL_META[ticket.channel] ?? CHANNEL_META.portal;
          return (
            <div className="mb-2 flex items-center gap-1.5 text-[12.5px] text-ink-faint">
              <span>{t('ticketDetail.createdFrom')}:</span>
              <Icon className="h-3.5 w-3.5 flex-none" />
              <span className="text-ink-muted">{t(labelKey)}</span>
            </div>
          );
        })()}
        <ActionButton label={t('ticketDetail.clientHistory')} onClick={() => setClientHistoryOpen(true)} />
      </div>

      <div className="flex flex-col gap-1.5 border-b border-border p-4">
        <div className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{t('ticketDetail.actions')}</div>
        <ActionButton
          label={watchStatus?.isWatching ? t('ticketDetail.watching') : t('ticketDetail.notWatching')}
          onClick={() =>
            watchStatus?.isWatching
              ? unwatch.mutate({ id: ticket.id, args: [] })
              : watch.mutate({ id: ticket.id, args: [] })
          }
          disabled={isDeleted}
        />
        <ActionButton
          label={t('ticketDetail.merge')}
          onClick={() => setMergeModalOpen(true)}
          disabled={!!ticket.mergedIntoId || isDeleted}
        />
        <ActionButton
          label={isExporting ? t('ticketDetail.exporting') : t('ticketDetail.export')}
          onClick={handleExport}
          disabled={isExporting}
        />
        <ActionButton
          label={sendStatusEmail.isPending ? t('ticketDetail.sendingStatus') : t('ticketDetail.sendStatus')}
          onClick={handleSendStatus}
          disabled={sendStatusEmail.isPending || isDeleted}
        />
        {!isDeleted && (
          <ActionButton label={t('ticketDetail.deleteToTrash')} onClick={handleDelete} disabled={deleteTicket.isPending} danger />
        )}
        {deleteError && <p className="text-xs text-priority-urgent">{deleteError}</p>}
      </div>

      <div className="flex-1 p-4">
        <ActionButton
          label={`${t('ticketDetail.audit')}${activity && activity.length > 0 ? ` (${activity.length})` : ''}`}
          onClick={() => setAuditOpen(true)}
        />
      </div>

      {isMergeModalOpen && <MergeTicketModal ticket={ticket} onClose={() => setMergeModalOpen(false)} />}
      {isAuditOpen && <TicketAuditModal ticketId={ticket.id} onClose={() => setAuditOpen(false)} />}
      {isClientHistoryOpen && (
        <ClientHistoryModal clientId={ticket.createdBy} excludeTicketId={ticket.id} onClose={() => setClientHistoryOpen(false)} />
      )}
    </aside>
  );
}
