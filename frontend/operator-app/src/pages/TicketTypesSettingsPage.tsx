import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TicketTypeModal } from '../components/settings/TicketTypeModal.js';
import { useDeleteTicketType, useMoveTicketType, useTicketTypes } from '../hooks/useTicketTypes.js';
import { getErrorMessage } from '../lib/errors.js';
import { pickLocalized } from '../lib/localized.js';
import type { PublicTicketType } from '../lib/types.js';

export default function TicketTypesSettingsPage() {
  const { t, i18n } = useTranslation();
  const { data: types, isLoading } = useTicketTypes();
  const deleteType = useDeleteTicketType();
  const moveType = useMoveTicketType();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingType, setEditingType] = useState<PublicTicketType | null>(null);

  function handleDelete(type: PublicTicketType) {
    if (!window.confirm(t('admin.ticketTypes.deleteConfirm', { name: type.name }))) return;
    deleteType.mutate(type.id);
  }

  const actionError = deleteType.error
    ? getErrorMessage(deleteType.error)
    : moveType.error
      ? getErrorMessage(moveType.error)
      : undefined;
  const list = types ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-none flex-wrap items-center justify-between gap-2 px-4 pb-3.5 pt-4 sm:px-6">
        <div>
          <div className="font-display text-lg font-bold">{t('admin.ticketTypes.title')}</div>
          <div className="mt-0.5 text-[12.5px] text-ink-subtle">{t('admin.ticketTypes.subtitle')}</div>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover"
        >
          {t('admin.ticketTypes.newType')}
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6 sm:px-6">
        {isLoading && <div className="py-16 text-center text-sm text-ink-subtle">{t('common.loading')}</div>}

        {actionError && (
          <p className="mb-3 rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{actionError}</p>
        )}

        {!isLoading && list.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface-card">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2.5 font-bold">{t('admin.ticketTypes.columnType')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.ticketTypes.columnWeight')}</th>
                  <th className="px-4 py-2.5 font-bold" />
                  <th className="px-4 py-2.5 font-bold" />
                </tr>
              </thead>
              <tbody>
                {list.map((type, index) => (
                  <tr
                    key={type.id}
                    onClick={() => setEditingType(type)}
                    className="cursor-pointer border-b border-border-subtle text-[13.5px] last:border-0 hover:bg-surface-muted"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: type.color }} />
                        <span className="font-medium">
                          {type.key ? t(`ticketType.${type.key}`) : pickLocalized(type.name, type.nameUk, type.nameEn, i18n.language)}
                        </span>
                        {type.isDefault && (
                          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10.5px] font-semibold text-brand-700">
                            {t('admin.ticketTypes.defaultBadge')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-subtle">{type.weight}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        disabled={index === 0 || moveType.isPending}
                        onClick={() => moveType.mutate({ id: type.id, direction: 'up' })}
                        title={t('admin.ticketTypes.moveUp')}
                        className="px-1 text-ink-faint hover:text-brand-600 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={index === list.length - 1 || moveType.isPending}
                        onClick={() => moveType.mutate({ id: type.id, direction: 'down' })}
                        title={t('admin.ticketTypes.moveDown')}
                        className="px-1 text-ink-faint hover:text-brand-600 disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setEditingType(type)}
                        className="text-[12.5px] font-medium text-brand-600 hover:underline"
                      >
                        {t('admin.ticketTypes.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(type)}
                        className="ml-3 text-[12.5px] font-medium text-priority-urgent hover:underline"
                      >
                        {t('admin.ticketTypes.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isCreateOpen && <TicketTypeModal existing={undefined} onClose={() => setCreateOpen(false)} />}
      {editingType && <TicketTypeModal existing={editingType} onClose={() => setEditingType(null)} />}
    </div>
  );
}
