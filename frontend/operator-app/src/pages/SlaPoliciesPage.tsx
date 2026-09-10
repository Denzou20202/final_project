import type { TicketPriority } from '@veloxdesk/types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SlaPolicyModal } from '../components/settings/SlaPolicyModal.js';
import { useCurrentUser } from '../hooks/useAuth.js';
import { useDeleteSlaPolicy, useSlaPolicies } from '../hooks/useSlaPolicies.js';
import { getErrorMessage } from '../lib/errors.js';
import type { PublicSlaPolicy } from '../lib/types.js';

// Urgent-first — same order the priority filter dropdown reads.
const PRIORITY_ROWS: TicketPriority[] = [
  'urgent' as TicketPriority,
  'high' as TicketPriority,
  'medium' as TicketPriority,
  'low' as TicketPriority,
];

export default function SlaPoliciesPage() {
  const { t } = useTranslation();
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'admin';
  const { data: policies, isLoading } = useSlaPolicies();
  const deletePolicy = useDeleteSlaPolicy();
  const [editingPriority, setEditingPriority] = useState<TicketPriority | null>(null);

  const byPriority = new Map<TicketPriority, PublicSlaPolicy>((policies ?? []).map((p) => [p.priority, p]));

  function handleDelete(policy: PublicSlaPolicy) {
    if (!window.confirm(t('admin.sla.deleteConfirm', { name: policy.name }))) return;
    deletePolicy.mutate(policy.id);
  }

  const deleteError = deletePolicy.error ? getErrorMessage(deletePolicy.error) : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-none px-6 pb-3.5 pt-4">
        <div className="font-display text-lg font-bold">{t('admin.sla.title')}</div>
        <div className="mt-0.5 text-[12.5px] text-ink-subtle">{t('admin.sla.subtitle')}</div>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        {isLoading && <div className="py-16 text-center text-sm text-ink-subtle">{t('common.loading')}</div>}

        {deleteError && (
          <p className="mb-3 rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{deleteError}</p>
        )}

        {!isLoading && (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface-card">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2.5 font-bold">{t('admin.sla.columnPriority')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.sla.columnPolicy')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.sla.columnResponse')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.sla.columnResolution')}</th>
                  {isAdmin && <th className="px-4 py-2.5 font-bold" />}
                </tr>
              </thead>
              <tbody>
                {PRIORITY_ROWS.map((value) => {
                  const policy = byPriority.get(value);
                  return (
                    <tr
                      key={value}
                      onClick={isAdmin ? () => setEditingPriority(value) : undefined}
                      className={`border-b border-border-subtle text-[13.5px] last:border-0 ${isAdmin ? 'cursor-pointer hover:bg-surface-muted' : ''}`}
                    >
                      <td className="px-4 py-3 font-medium">{t(`ticketPriority.${value}`)}</td>
                      <td className="px-4 py-3 text-ink-muted">{policy?.name ?? t('admin.sla.notConfigured')}</td>
                      <td className="px-4 py-3 text-ink-muted">
                        {policy ? t('admin.sla.minutesValue', { count: policy.responseTimeMin }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">
                        {policy ? t('admin.sla.minutesValue', { count: policy.resolutionTimeMin }) : '—'}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setEditingPriority(value)}
                            className="text-[12.5px] font-medium text-brand-600 hover:underline"
                          >
                            {policy ? t('admin.sla.edit') : t('admin.sla.configure')}
                          </button>
                          {policy && (
                            <button
                              type="button"
                              onClick={() => handleDelete(policy)}
                              className="ml-3 text-[12.5px] font-medium text-priority-urgent hover:underline"
                            >
                              {t('admin.sla.delete')}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingPriority && (
        <SlaPolicyModal
          priority={editingPriority}
          existing={byPriority.get(editingPriority)}
          onClose={() => setEditingPriority(null)}
        />
      )}
    </div>
  );
}
