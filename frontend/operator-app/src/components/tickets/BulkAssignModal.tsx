import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTeams } from '../../hooks/useTeams.js';
import { useAssignableUsers } from '../../hooks/useUsers.js';
import { assignTicket } from '../../lib/api/tickets.api.js';
import { pickLocalized } from '../../lib/localized.js';
import { isAssignableStaff } from '../../lib/staff.js';

export function BulkAssignModal({
  ticketIds,
  onDone,
  onClose,
}: {
  ticketIds: string[];
  onDone: (summary: string) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { data: usersPage } = useAssignableUsers();
  const { data: teams } = useTeams();
  const [teamId, setTeamId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [isSaving, setSaving] = useState(false);

  const allStaff = (usersPage?.items ?? []).filter(isAssignableStaff);
  const staff = teamId ? allStaff.filter((u) => u.teamId === teamId) : allStaff;

  function handleTeamChange(nextTeamId: string) {
    setTeamId(nextTeamId);
    // The previously picked employee may not belong to the newly selected
    // department — don't leave a hidden, stale selection behind.
    setAssigneeId((prev) => {
      const user = allStaff.find((u) => u.id === prev);
      return nextTeamId && user?.teamId !== nextTeamId ? '' : prev;
    });
  }

  async function handleAssign() {
    if (!assigneeId || isSaving) return;
    setSaving(true);
    // Sequential, not Promise.all — same nginx per-IP rate-limit reasoning
    // as the bulk actions on TicketsPage.
    let failed = 0;
    for (const id of ticketIds) {
      try {
        await assignTicket(id, assigneeId);
      } catch {
        failed += 1;
      }
    }
    onDone(
      failed === 0
        ? t('ticketModals.assignedAll', { count: ticketIds.length })
        : t('ticketModals.assignedPartial', { done: ticketIds.length - failed, total: ticketIds.length }),
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="h-full w-full overflow-y-auto bg-surface-card p-6 shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl sm:border sm:border-border">
        <h2 className="mb-1 font-display text-base font-bold">{t('ticketModals.assignTitle')}</h2>
        <p className="mb-4 text-[12.5px] text-ink-subtle">
          {t('ticketModals.assignSubtitle', { count: ticketIds.length })}
        </p>
        <label htmlFor="bulk-assign-team" className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
          {t('ticketFields.team')}
        </label>
        <select
          id="bulk-assign-team"
          value={teamId}
          onChange={(e) => handleTeamChange(e.target.value)}
          className="mb-3 w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
        >
          <option value="">{t('ticketModals.allTeams')}</option>
          {(teams ?? []).map((team) => (
            <option key={team.id} value={team.id}>
              {pickLocalized(team.name, team.nameUk, team.nameEn, i18n.language)}
            </option>
          ))}
        </select>

        <label
          htmlFor="bulk-assign-staff"
          className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint"
        >
          {t('ticketFields.assignee')}
        </label>
        <select
          id="bulk-assign-staff"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
        >
          <option value="">{t('ticketModals.selectStaff')}</option>
          {staff.map((user) => (
            <option key={user.id} value={user.id}>
              {user.fullName}
            </option>
          ))}
        </select>
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
            onClick={() => void handleAssign()}
            disabled={!assigneeId || isSaving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {isSaving ? t('ticketModals.assigning') : t('tickets.assign')}
          </button>
        </div>
      </div>
    </div>
  );
}
