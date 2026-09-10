import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TeamModal } from '../components/settings/TeamModal.js';
import { useCurrentUser } from '../hooks/useAuth.js';
import { useDeleteTeam, useTeams } from '../hooks/useTeams.js';
import { useAssignableUsers } from '../hooks/useUsers.js';
import { getErrorMessage } from '../lib/errors.js';
import { pickLocalized } from '../lib/localized.js';
import type { PublicTeam } from '../lib/types.js';

export default function TeamsSettingsPage() {
  const { t, i18n } = useTranslation();
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'admin';
  const { data: teams, isLoading } = useTeams();
  const { data: usersPage } = useAssignableUsers();
  const deleteTeam = useDeleteTeam();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<PublicTeam | null>(null);

  const nameById = new Map((usersPage?.items ?? []).map((u) => [u.id, u.fullName]));

  function memberNames(team: PublicTeam): string {
    if (team.memberIds.length === 0) return t('admin.teams.noOperators');
    return team.memberIds.map((id) => nameById.get(id) ?? '…').join(', ');
  }

  function handleDelete(team: PublicTeam) {
    if (!window.confirm(t('admin.teams.deleteConfirm', { name: team.name }))) return;
    deleteTeam.mutate(team.id);
  }

  const deleteError = deleteTeam.error ? getErrorMessage(deleteTeam.error) : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-none flex-wrap items-center justify-between gap-2 px-4 pb-3.5 pt-4 sm:px-6">
        <div>
          <div className="font-display text-lg font-bold">{t('admin.teams.title')}</div>
          <div className="mt-0.5 text-[12.5px] text-ink-subtle">{t('admin.teams.subtitle')}</div>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover"
          >
            {t('admin.teams.newTeam')}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6 sm:px-6">
        {isLoading && <div className="py-16 text-center text-sm text-ink-subtle">{t('common.loading')}</div>}

        {deleteError && (
          <p className="mb-3 rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{deleteError}</p>
        )}

        {!isLoading && (teams ?? []).length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface-card py-16 text-center">
            <div className="font-display text-sm font-semibold text-ink-muted">{t('admin.teams.empty')}</div>
          </div>
        )}

        {!isLoading && (teams?.length ?? 0) > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface-card">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2.5 font-bold">{t('admin.teams.columnName')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.teams.columnOperators')}</th>
                  {isAdmin && <th className="px-4 py-2.5 font-bold" />}
                </tr>
              </thead>
              <tbody>
                {(teams ?? []).map((team) => (
                  <tr
                    key={team.id}
                    onClick={isAdmin ? () => setEditingTeam(team) : undefined}
                    className={`border-b border-border-subtle text-[13.5px] last:border-0 ${isAdmin ? 'cursor-pointer hover:bg-surface-muted' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium">{pickLocalized(team.name, team.nameUk, team.nameEn, i18n.language)}</td>
                    <td className="max-w-md truncate px-4 py-3 text-ink-muted">{memberNames(team)}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setEditingTeam(team)}
                          className="text-[12.5px] font-medium text-brand-600 hover:underline"
                        >
                          {t('admin.teams.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(team)}
                          className="ml-3 text-[12.5px] font-medium text-priority-urgent hover:underline"
                        >
                          {t('admin.teams.delete')}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isCreateOpen && <TeamModal existing={undefined} onClose={() => setCreateOpen(false)} />}
      {editingTeam && <TeamModal existing={editingTeam} onClose={() => setEditingTeam(null)} />}
    </div>
  );
}
