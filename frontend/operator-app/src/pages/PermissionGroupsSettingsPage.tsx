import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PermissionGroupModal } from '../components/settings/PermissionGroupModal.js';
import { useDeletePermissionGroup, usePermissionGroups } from '../hooks/usePermissionGroups.js';
import { getErrorMessage } from '../lib/errors.js';
import type { PublicPermissionGroup } from '../lib/types.js';

const BADGE_CLASS = 'rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-ink-muted';

function badges(t: TFunction, group: PublicPermissionGroup): string[] {
  const list: string[] = [];
  if (group.restrictToDepartments) list.push(t('admin.permissionGroups.badgeDepartments', { count: group.departmentIds.length }));
  if (group.restrictToOwnTickets) list.push(t('admin.permissionGroups.badgeOwnTicketsOnly'));
  if (group.cannotBeAssignee) list.push(t('admin.permissionGroups.badgeObserver'));
  if (group.requireTwoFactor) list.push(t('admin.permissionGroups.badgeRequire2fa'));
  if (group.ipWhitelist.length > 0) list.push(t('admin.permissionGroups.badgeIpWhitelist', { count: group.ipWhitelist.length }));
  return list;
}

export default function PermissionGroupsSettingsPage() {
  const { t } = useTranslation();
  const { data: groups, isLoading } = usePermissionGroups();
  const deleteGroup = useDeletePermissionGroup();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PublicPermissionGroup | null>(null);

  function handleDelete(group: PublicPermissionGroup) {
    const warning =
      group.memberCount > 0
        ? t('admin.permissionGroups.deleteConfirmWithMembers', { name: group.name, count: group.memberCount })
        : t('admin.permissionGroups.deleteConfirmSimple', { name: group.name });
    if (!window.confirm(warning)) return;
    deleteGroup.mutate(group.id);
  }

  const deleteError = deleteGroup.error ? getErrorMessage(deleteGroup.error) : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-none flex-wrap items-center justify-between gap-2 px-4 pb-3.5 pt-4 sm:px-6">
        <div>
          <div className="font-display text-lg font-bold">{t('admin.permissionGroups.title')}</div>
          <div className="mt-0.5 text-[12.5px] text-ink-subtle">{t('admin.permissionGroups.subtitle')}</div>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover"
        >
          {t('admin.permissionGroups.newGroup')}
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6 sm:px-6">
        {isLoading && <div className="py-16 text-center text-sm text-ink-subtle">{t('common.loading')}</div>}

        {deleteError && (
          <p className="mb-3 rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{deleteError}</p>
        )}

        {!isLoading && (groups ?? []).length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface-card py-16 text-center">
            <div className="font-display text-sm font-semibold text-ink-muted">{t('admin.permissionGroups.empty')}</div>
            <div className="mt-1 text-[13px] text-ink-faint">{t('admin.permissionGroups.emptyHint')}</div>
          </div>
        )}

        {!isLoading && (groups?.length ?? 0) > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface-card">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2.5 font-bold">{t('admin.permissionGroups.columnName')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.permissionGroups.columnRestrictions')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.permissionGroups.columnMembers')}</th>
                  <th className="px-4 py-2.5 font-bold" />
                </tr>
              </thead>
              <tbody>
                {(groups ?? []).map((group) => (
                  <tr
                    key={group.id}
                    onClick={() => setEditingGroup(group)}
                    className="cursor-pointer border-b border-border-subtle text-[13.5px] last:border-0 hover:bg-surface-muted"
                  >
                    <td className="px-4 py-3 font-medium">{group.name}</td>
                    <td className="px-4 py-3">
                      {badges(t, group).length === 0 ? (
                        <span className="text-ink-faint">{t('admin.permissionGroups.noRestrictions')}</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {badges(t, group).map((label) => (
                            <span key={label} className={BADGE_CLASS}>
                              {label}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{group.memberCount}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setEditingGroup(group)}
                        className="text-[12.5px] font-medium text-brand-600 hover:underline"
                      >
                        {t('admin.permissionGroups.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(group)}
                        className="ml-3 text-[12.5px] font-medium text-priority-urgent hover:underline"
                      >
                        {t('admin.permissionGroups.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isCreateOpen && <PermissionGroupModal existing={undefined} onClose={() => setCreateOpen(false)} />}
      {editingGroup && <PermissionGroupModal existing={editingGroup} onClose={() => setEditingGroup(null)} />}
    </div>
  );
}
