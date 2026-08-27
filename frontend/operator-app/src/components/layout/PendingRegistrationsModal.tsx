import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useApproveRegistration,
  usePendingRegistrations,
  useRejectRegistration,
} from '../../hooks/usePendingRegistrations.js';
import { formatDateTime } from '../../lib/format.js';
import { CloseIcon } from '../common/icons.js';
import { PageLoading } from '../common/PageLoading.js';

// Same overlay/escape-close/header shell as ReportsHubModal/ClientHistoryModal
// (h-[85vh] w-[85vw]), minus the left <aside> nav — this is a single list,
// no sub-sections.
export function PendingRegistrationsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { data: users, isLoading } = usePendingRegistrations(true);
  const approve = useApproveRegistration();
  const reject = useRejectRegistration();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleReject(user: { id: string; fullName: string }) {
    if (!window.confirm(t('pendingRegistrations.rejectConfirm', { name: user.fullName }))) {
      return;
    }
    reject.mutate(user.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-surface-card shadow-lg sm:h-[85vh] sm:w-[85vw] sm:rounded-2xl sm:border sm:border-border">
        <div className="flex flex-none items-center justify-between border-b border-border px-5 py-3">
          <div>
            <div className="font-display text-base font-bold">{t('pendingRegistrations.title')}</div>
            <div className="mt-0.5 text-[12.5px] text-ink-subtle">
              {t('pendingRegistrations.count', { count: users?.length ?? 0 })}
            </div>
          </div>
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

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {isLoading && <PageLoading />}

          {!isLoading && (users?.length ?? 0) === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="font-display text-sm font-semibold text-ink-muted">
                {t('pendingRegistrations.empty')}
              </div>
            </div>
          )}

          {!isLoading && (users?.length ?? 0) > 0 && (
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                    <th className="px-4 py-2.5 font-bold">{t('pendingRegistrations.columnName')}</th>
                    <th className="px-4 py-2.5 font-bold">{t('pendingRegistrations.columnEmail')}</th>
                    <th className="px-4 py-2.5 font-bold">{t('pendingRegistrations.columnDate')}</th>
                    <th className="px-4 py-2.5 font-bold" />
                  </tr>
                </thead>
                <tbody>
                  {users?.map((user) => (
                    <tr key={user.id} className="border-b border-border-subtle text-[13.5px] last:border-0">
                      <td className="px-4 py-3 font-medium">{user.fullName}</td>
                      <td className="px-4 py-3 text-ink-muted">{user.email}</td>
                      <td className="px-4 py-3 text-ink-muted">{formatDateTime(user.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleReject(user)}
                            disabled={reject.isPending}
                            className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-muted hover:text-priority-urgent disabled:opacity-50"
                          >
                            {t('pendingRegistrations.reject')}
                          </button>
                          <button
                            type="button"
                            onClick={() => approve.mutate(user.id)}
                            disabled={approve.isPending}
                            className="rounded-lg bg-brand-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
                          >
                            {t('pendingRegistrations.activate')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
