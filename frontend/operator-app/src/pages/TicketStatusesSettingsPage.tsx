import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TicketStatusModal } from '../components/settings/TicketStatusModal.js';
import { useDeleteTicketStatus, useMoveTicketStatus, useTicketStatuses } from '../hooks/useTicketStatuses.js';
import { getErrorMessage } from '../lib/errors.js';
import { pickLocalized } from '../lib/localized.js';
import type { PublicTicketStatus } from '../lib/types.js';

export default function TicketStatusesSettingsPage() {
  const { t, i18n } = useTranslation();
  const { data: statuses, isLoading } = useTicketStatuses();
  const deleteStatus = useDeleteTicketStatus();
  const moveStatus = useMoveTicketStatus();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<PublicTicketStatus | null>(null);

  function handleDelete(status: PublicTicketStatus) {
    if (!window.confirm(t('admin.ticketStatuses.deleteConfirm', { name: status.name }))) return;
    deleteStatus.mutate(status.id);
  }

  const deleteError = deleteStatus.error ? getErrorMessage(deleteStatus.error) : undefined;
  const list = statuses ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-none flex-wrap items-center justify-between gap-2 px-4 pb-3.5 pt-4 sm:px-6">
        <div>
          <div className="font-display text-lg font-bold">{t('admin.ticketStatuses.title')}</div>
          <div className="mt-0.5 text-[12.5px] text-ink-subtle">{t('admin.ticketStatuses.subtitle')}</div>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover"
        >
          {t('admin.ticketStatuses.newStatus')}
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6 sm:px-6">
        {isLoading && <div className="py-16 text-center text-sm text-ink-subtle">{t('common.loading')}</div>}

        {deleteError && (
          <p className="mb-3 rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{deleteError}</p>
        )}

        {!isLoading && list.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface-card">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2.5 font-bold">{t('admin.ticketStatuses.columnStatus')}</th>
                  <th className="px-4 py-2.5 font-bold" />
                  <th className="px-4 py-2.5 font-bold" />
                </tr>
              </thead>
              <tbody>
                {list.map((status, index) => (
                  <tr
                    key={status.id}
                    onClick={() => setEditingStatus(status)}
                    className="cursor-pointer border-b border-border-subtle text-[13.5px] last:border-0 hover:bg-surface-muted"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: status.color }} />
                        <span className="font-medium">{pickLocalized(status.name, status.nameUk, status.nameEn, i18n.language)}</span>
                        {status.isDefault && (
                          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10.5px] font-semibold text-brand-700">
                            {t('admin.ticketStatuses.defaultBadge')}
                          </span>
                        )}
                        {status.isClosed && (
                          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10.5px] font-semibold text-ink-faint">
                            {t('admin.ticketStatuses.closedBadge')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        disabled={index === 0 || moveStatus.isPending}
                        onClick={() => moveStatus.mutate({ id: status.id, direction: 'up' })}
                        title={t('admin.ticketStatuses.moveUp')}
                        className="px-1 text-ink-faint hover:text-brand-600 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={index === list.length - 1 || moveStatus.isPending}
                        onClick={() => moveStatus.mutate({ id: status.id, direction: 'down' })}
                        title={t('admin.ticketStatuses.moveDown')}
                        className="px-1 text-ink-faint hover:text-brand-600 disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setEditingStatus(status)}
                        className="text-[12.5px] font-medium text-brand-600 hover:underline"
                      >
                        {t('admin.ticketStatuses.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(status)}
                        className="ml-3 text-[12.5px] font-medium text-priority-urgent hover:underline"
                      >
                        {t('admin.ticketStatuses.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isCreateOpen && <TicketStatusModal existing={undefined} onClose={() => setCreateOpen(false)} />}
      {editingStatus && <TicketStatusModal existing={editingStatus} onClose={() => setEditingStatus(null)} />}
    </div>
  );
}
