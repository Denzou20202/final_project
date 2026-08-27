import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmployeeStatusModal } from '../components/settings/EmployeeStatusModal.js';
import {
  useDeleteEmployeeStatus,
  useEmployeeStatuses,
  usePresenceSettings,
  useUpdatePresenceSettings,
} from '../hooks/useEmployeeStatuses.js';
import { getErrorMessage } from '../lib/errors.js';
import { pickLocalized } from '../lib/localized.js';
import type { PublicEmployeeStatus } from '../lib/types.js';

export default function EmployeeStatusesSettingsPage() {
  const { t, i18n } = useTranslation();
  const { data: statuses, isLoading } = useEmployeeStatuses();
  const deleteStatus = useDeleteEmployeeStatus();
  const { data: settings } = usePresenceSettings();
  const updateSettings = useUpdatePresenceSettings();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<PublicEmployeeStatus | null>(null);
  const [timeoutInput, setTimeoutInput] = useState('');

  useEffect(() => {
    if (settings) setTimeoutInput(String(settings.inactivityTimeoutMinutes));
  }, [settings]);

  function handleDelete(status: PublicEmployeeStatus) {
    if (!window.confirm(t('admin.employeeStatuses.deleteConfirm', { name: status.name }))) return;
    deleteStatus.mutate(status.id);
  }

  function handleTimeoutBlur() {
    const parsed = Number(timeoutInput);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 240 || parsed === settings?.inactivityTimeoutMinutes) return;
    updateSettings.mutate(parsed);
  }

  const deleteError = deleteStatus.error ? getErrorMessage(deleteStatus.error) : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-none flex-wrap items-center justify-between gap-2 px-4 pb-3.5 pt-4 sm:px-6">
        <div>
          <div className="font-display text-lg font-bold">{t('admin.employeeStatuses.title')}</div>
          <div className="mt-0.5 text-[12.5px] text-ink-subtle">{t('admin.employeeStatuses.subtitle')}</div>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover"
        >
          {t('admin.employeeStatuses.newStatus')}
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6 sm:px-6">
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-surface-card px-4 py-3">
          <label htmlFor="idle-timeout" className="text-[13px] font-medium text-ink-muted">
            {t('admin.employeeStatuses.idleTimeoutLabel')}
          </label>
          <input
            id="idle-timeout"
            type="number"
            min={1}
            max={240}
            value={timeoutInput}
            onChange={(e) => setTimeoutInput(e.target.value)}
            onBlur={handleTimeoutBlur}
            className="w-16 rounded-lg border border-border px-2 py-1 text-center text-sm outline-none focus:border-brand-600"
          />
          <span className="text-[13px] text-ink-muted">{t('admin.employeeStatuses.idleTimeoutSuffix')}</span>
          {updateSettings.isPending && <span className="text-[11.5px] text-ink-faint">{t('common.saving')}</span>}
        </div>

        {isLoading && <div className="py-16 text-center text-sm text-ink-subtle">{t('common.loading')}</div>}

        {deleteError && (
          <p className="mb-3 rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{deleteError}</p>
        )}

        {!isLoading && (statuses ?? []).length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface-card py-16 text-center">
            <div className="font-display text-sm font-semibold text-ink-muted">{t('admin.employeeStatuses.empty')}</div>
            <div className="mt-1 text-[13px] text-ink-faint">{t('admin.employeeStatuses.emptyHint')}</div>
          </div>
        )}

        {!isLoading && (statuses?.length ?? 0) > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface-card">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2.5 font-bold">{t('admin.employeeStatuses.columnStatus')}</th>
                  <th className="px-4 py-2.5 font-bold" />
                </tr>
              </thead>
              <tbody>
                {(statuses ?? []).map((status) => (
                  <tr
                    key={status.id}
                    onClick={() => setEditingStatus(status)}
                    className="cursor-pointer border-b border-border-subtle text-[13.5px] last:border-0 hover:bg-surface-muted"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 flex-none rounded-full"
                          style={{ backgroundColor: status.color }}
                        />
                        <span className="font-medium">{pickLocalized(status.name, status.nameUk, status.nameEn, i18n.language)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setEditingStatus(status)}
                        className="text-[12.5px] font-medium text-brand-600 hover:underline"
                      >
                        {t('admin.employeeStatuses.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(status)}
                        className="ml-3 text-[12.5px] font-medium text-priority-urgent hover:underline"
                      >
                        {t('admin.employeeStatuses.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isCreateOpen && <EmployeeStatusModal existing={undefined} onClose={() => setCreateOpen(false)} />}
      {editingStatus && <EmployeeStatusModal existing={editingStatus} onClose={() => setEditingStatus(null)} />}
    </div>
  );
}
