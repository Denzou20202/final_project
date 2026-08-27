import { useCallback, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAutoTranslate } from '../../hooks/useAutoTranslate.js';
import { useCreateTeam, useUpdateTeam } from '../../hooks/useTeams.js';
import { useAssignableUsers } from '../../hooks/useUsers.js';
import { getErrorMessage } from '../../lib/errors.js';
import type { PublicTeam } from '../../lib/types.js';
import { Checkbox } from '../common/Checkbox.js';

export function TeamModal({ existing, onClose }: { existing: PublicTeam | undefined; onClose: () => void }) {
  const { t } = useTranslation();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const { data: usersPage } = useAssignableUsers();
  const [name, setName] = useState(existing?.name ?? '');
  const [nameUk, setNameUk] = useState(existing?.nameUk ?? '');
  const [nameEn, setNameEn] = useState(existing?.nameEn ?? '');
  const [ukEnTouched, setUkEnTouched] = useState(!!existing);
  useAutoTranslate(
    name,
    !ukEnTouched,
    useCallback((uk, en) => {
      if (uk) setNameUk(uk);
      if (en) setNameEn(en);
    }, []),
  );
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set(existing?.memberIds ?? []));

  // Staff only — a department's roster routes tickets to operators, a
  // client id here wouldn't mean anything (and the backend rejects it too).
  const staff = (usersPage?.items ?? []).filter((u) => u.role !== 'client' && !u.deactivatedAt);

  function toggleMember(id: string) {
    setMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const input = { name: trimmed, nameUk: nameUk.trim(), nameEn: nameEn.trim(), memberIds: [...memberIds] };
    if (existing) {
      updateTeam.mutate({ id: existing.id, ...input }, { onSuccess: onClose });
    } else {
      createTeam.mutate(input, { onSuccess: onClose });
    }
  }

  const mutation = existing ? updateTeam : createTeam;
  const errorMessage = mutation.error ? getErrorMessage(mutation.error) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="flex h-full w-full flex-col overflow-y-auto bg-surface-card p-6 shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl sm:border sm:border-border">
        <h2 className="mb-4 font-display text-base font-bold">
          {existing ? t('admin.teams.editTitle') : t('admin.teams.newTitle')}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
          <div>
            <label htmlFor="team-name" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.teams.nameLabel')}
            </label>
            <input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
            />
            {!name.trim() && <p className="mt-1 text-xs text-ink-faint">{t('admin.teams.nameRequired')}</p>}
          </div>

          <div>
            <label htmlFor="team-name-uk" className="mb-1 block text-sm font-medium text-ink-muted">
              UK
            </label>
            <input
              id="team-name-uk"
              value={nameUk}
              onChange={(e) => {
                setNameUk(e.target.value);
                setUkEnTouched(true);
              }}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
            />
          </div>

          <div>
            <label htmlFor="team-name-en" className="mb-1 block text-sm font-medium text-ink-muted">
              EN
            </label>
            <input
              id="team-name-en"
              value={nameEn}
              onChange={(e) => {
                setNameEn(e.target.value);
                setUkEnTouched(true);
              }}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
            />
            <p className="mt-1 text-[11px] text-ink-faint">{t('settings.autoTranslateHint')}</p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-ink-muted">{t('admin.teams.operatorsLabel')}</span>
              <span className="text-[11.5px] text-ink-faint">
                {t('admin.teams.selectedCount', { count: memberIds.size })}
              </span>
            </div>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
              {staff.map((user) => (
                <label
                  key={user.id}
                  htmlFor={`team-member-${user.id}`}
                  className="flex items-center gap-2 border-b border-border-subtle px-2.5 py-2 text-[13px] last:border-0 hover:bg-surface-muted"
                >
                  <Checkbox
                    id={`team-member-${user.id}`}
                    checked={memberIds.has(user.id)}
                    onChange={() => toggleMember(user.id)}
                  />
                  <span className="min-w-0 flex-1 truncate">{user.fullName}</span>
                  <span className="flex-none text-[11px] text-ink-faint">
                    {user.role === 'admin' ? t('userRole.admin') : t('userRole.operator')}
                  </span>
                </label>
              ))}
              {staff.length === 0 && (
                <div className="px-2.5 py-3 text-[12.5px] text-ink-faint">{t('admin.teams.noStaff')}</div>
              )}
            </div>
          </div>

          {errorMessage && (
            <p className="rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{errorMessage}</p>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={!name.trim() || mutation.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
            >
              {mutation.isPending ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
