import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useTeams } from '../../hooks/useTeams.js';
import { useCreatePermissionGroup, useUpdatePermissionGroup } from '../../hooks/usePermissionGroups.js';
import { getErrorMessage } from '../../lib/errors.js';
import { pickLocalized } from '../../lib/localized.js';
import type { PublicPermissionGroup } from '../../lib/types.js';
import { Checkbox } from '../common/Checkbox.js';

// One CIDR (or bare IP, implicit /32) per line — mirrors the backend's
// ip-cidr-match.ts format exactly, validated the same way server-side.
const CIDR_LINE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d|\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d|\d)){3}(\/(3[0-2]|[12]?\d))?$/;

export function PermissionGroupModal({
  existing,
  onClose,
}: {
  existing: PublicPermissionGroup | undefined;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { data: teams } = useTeams();
  const createGroup = useCreatePermissionGroup();
  const updateGroup = useUpdatePermissionGroup();

  const [name, setName] = useState(existing?.name ?? '');
  const [restrictToDepartments, setRestrictToDepartments] = useState(existing?.restrictToDepartments ?? false);
  const [departmentIds, setDepartmentIds] = useState<Set<string>>(new Set(existing?.departmentIds ?? []));
  const [restrictToOwnTickets, setRestrictToOwnTickets] = useState(existing?.restrictToOwnTickets ?? false);
  const [cannotBeAssignee, setCannotBeAssignee] = useState(existing?.cannotBeAssignee ?? false);
  const [requireTwoFactor, setRequireTwoFactor] = useState(existing?.requireTwoFactor ?? false);
  const [ipWhitelistText, setIpWhitelistText] = useState((existing?.ipWhitelist ?? []).join('\n'));
  const [ipError, setIpError] = useState<string | undefined>(undefined);

  function toggleDepartment(id: string) {
    setDepartmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function parseIpWhitelist(): string[] | null {
    const lines = ipWhitelistText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const invalid = lines.find((line) => !CIDR_LINE.test(line));
    if (invalid) {
      setIpError(t('admin.permissionGroups.ipInvalid', { value: invalid }));
      return null;
    }
    setIpError(undefined);
    return lines;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const ipWhitelist = parseIpWhitelist();
    if (ipWhitelist === null) return;

    const input = {
      name: trimmed,
      restrictToDepartments,
      departmentIds: [...departmentIds],
      restrictToOwnTickets,
      cannotBeAssignee,
      requireTwoFactor,
      ipWhitelist,
    };
    if (existing) {
      updateGroup.mutate({ id: existing.id, ...input }, { onSuccess: onClose });
    } else {
      createGroup.mutate(input, { onSuccess: onClose });
    }
  }

  const mutation = existing ? updateGroup : createGroup;
  const errorMessage = mutation.error ? getErrorMessage(mutation.error) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="flex h-full w-full flex-col overflow-y-auto bg-surface-card p-6 shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl sm:border sm:border-border">
        <h2 className="mb-4 font-display text-base font-bold">
          {existing ? t('admin.permissionGroups.editTitle') : t('admin.permissionGroups.newTitle')}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div>
            <label htmlFor="group-name" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.permissionGroups.nameLabel')}
            </label>
            <input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
            />
            {!name.trim() && <p className="mt-1 text-xs text-ink-faint">{t('admin.permissionGroups.nameRequired')}</p>}
          </div>

          <div className="rounded-lg border border-border p-3">
            <label htmlFor="group-restrict-departments" className="flex items-center gap-2">
              <Checkbox
                id="group-restrict-departments"
                checked={restrictToDepartments}
                onChange={(e) => setRestrictToDepartments(e.target.checked)}
              />
              <span className="text-sm font-medium">{t('admin.permissionGroups.restrictDepartmentsLabel')}</span>
            </label>
            <p className="mb-2 mt-1 text-[11.5px] text-ink-faint">{t('admin.permissionGroups.restrictDepartmentsHint')}</p>
            <div
              className={`max-h-40 overflow-y-auto rounded-lg border border-border ${!restrictToDepartments ? 'pointer-events-none opacity-40' : ''}`}
            >
              {(teams ?? []).map((team) => (
                <label
                  key={team.id}
                  htmlFor={`group-team-${team.id}`}
                  className="flex items-center gap-2 border-b border-border-subtle px-2.5 py-2 text-[13px] last:border-0 hover:bg-surface-muted"
                >
                  <Checkbox
                    id={`group-team-${team.id}`}
                    checked={departmentIds.has(team.id)}
                    onChange={() => toggleDepartment(team.id)}
                  />
                  <span className="min-w-0 flex-1 truncate">{pickLocalized(team.name, team.nameUk, team.nameEn, i18n.language)}</span>
                </label>
              ))}
              {(teams ?? []).length === 0 && (
                <div className="px-2.5 py-3 text-[12.5px] text-ink-faint">{t('admin.permissionGroups.noTeams')}</div>
              )}
            </div>
          </div>

          <label htmlFor="group-own-tickets" className="flex items-start gap-2">
            <Checkbox
              id="group-own-tickets"
              checked={restrictToOwnTickets}
              onChange={(e) => setRestrictToOwnTickets(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium">{t('admin.permissionGroups.ownTicketsLabel')}</span>
              <span className="block text-[11.5px] text-ink-faint">{t('admin.permissionGroups.ownTicketsHint')}</span>
            </span>
          </label>

          <label htmlFor="group-cannot-assignee" className="flex items-start gap-2">
            <Checkbox
              id="group-cannot-assignee"
              checked={cannotBeAssignee}
              onChange={(e) => setCannotBeAssignee(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium">{t('admin.permissionGroups.observerLabel')}</span>
              <span className="block text-[11.5px] text-ink-faint">{t('admin.permissionGroups.observerHint')}</span>
            </span>
          </label>

          <label htmlFor="group-require-2fa" className="flex items-start gap-2">
            <Checkbox
              id="group-require-2fa"
              checked={requireTwoFactor}
              onChange={(e) => setRequireTwoFactor(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium">{t('admin.permissionGroups.require2faLabel')}</span>
              <span className="block text-[11.5px] text-ink-faint">{t('admin.permissionGroups.require2faHint')}</span>
            </span>
          </label>

          <div>
            <label htmlFor="group-ip-whitelist" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.permissionGroups.ipWhitelistLabel')}
            </label>
            <textarea
              id="group-ip-whitelist"
              rows={3}
              value={ipWhitelistText}
              onChange={(e) => setIpWhitelistText(e.target.value)}
              placeholder={'203.0.113.0/24\n198.51.100.42'}
              className="w-full rounded-lg border border-border px-3 py-2 font-mono text-[12.5px] outline-none focus:border-brand-600"
            />
            <p className="mt-1 text-[11.5px] text-ink-faint">{t('admin.permissionGroups.ipWhitelistHint')}</p>
            {ipError && <p className="mt-1 text-xs text-priority-urgent">{ipError}</p>}
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
