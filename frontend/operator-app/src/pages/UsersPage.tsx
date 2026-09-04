import { SYSTEM_USER_ID } from '@veloxdesk/types';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VipBadge } from '../components/common/VipBadge.js';
import { DuplicateContactsModal } from '../components/settings/DuplicateContactsModal.js';
import { EditUserModal } from '../components/settings/EditUserModal.js';
import { CreateUserModal } from '../components/settings/CreateUserModal.js';
import { useCurrentUser } from '../hooks/useAuth.js';
import { useDownloadContactsCsv } from '../hooks/useContacts.js';
import { usePermissionGroups, useResetTwoFactor } from '../hooks/usePermissionGroups.js';
import { useDeactivateUser, useReactivateUser, useUsersPage } from '../hooks/useUsers.js';
import { getErrorMessage } from '../lib/errors.js';
import type { PublicUser } from '../lib/types.js';

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function UsersPage() {
  const { t } = useTranslation();
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'admin';

  // «Ищите нужного пользователя» — draft is local so typing stays instant;
  // the actual query (and with it the request) updates after a short pause.
  // Same 350ms debounce as TicketsPage's search box, minus the URL sync —
  // this admin table doesn't need a shareable/back-navigable search state.
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchDraft.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(50);
  // Real pagination (not "load more") — pageCursors[i] is the cursor that
  // fetches page i, so Prev never needs to re-derive anything, same pattern
  // as TicketsPage's pageCursors/pageIndex. Any search/pageSize change must
  // restart at page 1 — a cursor from the old query is meaningless against
  // the new one (doubly so across search ↔ non-search, which sort
  // differently on the backend — see NameCursor).
  const [pageCursors, setPageCursors] = useState<(string | undefined)[]>([undefined]);
  const [pageIndex, setPageIndex] = useState(0);
  useEffect(() => {
    setPageCursors([undefined]);
    setPageIndex(0);
  }, [search, pageSize]);

  const { data: usersPage, isLoading, isFetching } = useUsersPage(search, pageCursors[pageIndex], pageSize);
  // The seeded system account (SYSTEM_USER_ID — see libs/types/system-accounts.ts)
  // has to stay IN the shared GET /users response, since operator-app's
  // ChatPanel resolves automated-reply author names from this same query —
  // but it's not a real staff member an admin should see/manage here, so
  // it's filtered out of this one page instead of at the API level.
  const visibleUsers = (usersPage?.items ?? []).filter((u) => u.id !== SYSTEM_USER_ID);
  const hasNextPage = !!usersPage?.nextCursor;
  const hasPrevPage = pageIndex > 0;

  function goToNextPage() {
    if (!usersPage?.nextCursor) return;
    const cursor = usersPage.nextCursor;
    setPageCursors((prev) => {
      const next = [...prev];
      next[pageIndex + 1] = cursor;
      return next;
    });
    setPageIndex((i) => i + 1);
  }

  function goToPrevPage() {
    setPageIndex((i) => Math.max(0, i - 1));
  }

  const { data: permissionGroups } = usePermissionGroups();
  const deactivate = useDeactivateUser();
  const reactivate = useReactivateUser();
  const resetTwoFactor = useResetTwoFactor();
  const downloadContactsCsv = useDownloadContactsCsv();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isDuplicatesOpen, setDuplicatesOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<PublicUser | null>(null);

  const groupNameById = new Map((permissionGroups ?? []).map((g) => [g.id, g.name]));

  const actionError = deactivate.error
    ? getErrorMessage(deactivate.error)
    : reactivate.error
      ? getErrorMessage(reactivate.error)
      : resetTwoFactor.error
        ? getErrorMessage(resetTwoFactor.error)
        : undefined;

  function handleDeactivate(user: PublicUser) {
    if (!window.confirm(t('admin.users.deactivateConfirm', { name: user.fullName }))) {
      return;
    }
    deactivate.mutate(user.id);
  }

  function handleResetTwoFactor(user: PublicUser) {
    if (!window.confirm(t('admin.users.resetTwoFactorConfirm', { name: user.fullName }))) {
      return;
    }
    resetTwoFactor.mutate(user.id);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-none flex-col gap-2.5 px-4 pb-3.5 pt-4 sm:px-6">
        <div>
          <div className="font-display text-lg font-bold">{t('admin.users.title')}</div>
          <div className="mt-0.5 text-[12.5px] text-ink-subtle">{t('admin.users.subtitle')}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
          <input
            type="search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder={t('admin.users.searchPlaceholder')}
            className="w-full min-w-[120px] flex-1 basis-0 rounded-lg border border-border bg-surface-card px-3 py-1.5 text-[12.5px] outline-none focus:border-brand-600 sm:max-w-64"
          />
          {isAdmin && (
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap">
              <button
                type="button"
                onClick={() => downloadContactsCsv.mutate()}
                disabled={downloadContactsCsv.isPending}
                className="shrink-0 whitespace-nowrap rounded-lg border border-border px-3.5 py-2 text-[13px] font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-50"
              >
                {downloadContactsCsv.isPending ? t('common.saving') : t('admin.contacts.exportButton')}
              </button>
              <button
                type="button"
                onClick={() => setDuplicatesOpen(true)}
                className="shrink-0 whitespace-nowrap rounded-lg border border-border px-3.5 py-2 text-[13px] font-medium text-ink-muted hover:bg-surface-muted"
              >
                {t('admin.contacts.findDuplicatesButton')}
              </button>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="shrink-0 whitespace-nowrap rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover"
              >
                {t('admin.users.newUser')}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6 sm:px-6">
        {isLoading && <div className="py-16 text-center text-sm text-ink-subtle">{t('common.loading')}</div>}

        {actionError && (
          <p className="mb-3 rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{actionError}</p>
        )}

        {!isLoading && (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface-card">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2.5 font-bold">{t('admin.users.columnName')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.users.columnEmail')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.users.columnRole')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.users.columnGroup')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.users.columnRegistered')}</th>
                  {isAdmin && <th className="px-4 py-2.5 font-bold" />}
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => {
                  const isSelf = user.id === me?.id;
                  const isDeactivated = !!user.deactivatedAt;
                  // A restricted admin (see UserEntity.cannotManageAdmins)
                  // can't touch any OTHER admin's account at all — mirrors
                  // the backend's assertAdminActionAllowed check. Doesn't
                  // apply to a normal admin, and doesn't apply to rows that
                  // aren't admins.
                  const blockedByRestriction = !!me?.cannotManageAdmins && user.role === 'admin' && !isSelf;
                  // Only the pencil button used to open the edit card — fine
                  // on desktop where it's always in view, but on a phone the
                  // actions column sits past several other columns and the
                  // whole row is horizontal-scrolled off past it. Making the
                  // row itself clickable (same pattern as TicketsPage's <tr>)
                  // means editing a user never depends on scrolling to find
                  // one specific button.
                  const canOpenRow = isAdmin && !blockedByRestriction;
                  return (
                    <tr
                      key={user.id}
                      onClick={canOpenRow ? () => setEditingUser(user) : undefined}
                      className={`border-b border-border-subtle text-[13.5px] last:border-0 ${isDeactivated ? 'opacity-50' : ''} ${canOpenRow ? 'cursor-pointer hover:bg-surface-muted' : ''}`}
                    >
                      <td className="px-4 py-3 font-medium">
                        {user.fullName}
                        {user.role === 'client' && user.isVip && <VipBadge className="ml-1.5 align-middle" />}
                        {user.role === 'admin' && user.cannotManageAdmins && (
                          <span
                            title={t('admin.users.restrictedAdminHint')}
                            className="ml-2 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-faint"
                          >
                            {t('admin.users.restrictedAdminBadge')}
                          </span>
                        )}
                        {isDeactivated && (
                          <span className="ml-2 rounded-full bg-priority-urgent/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-priority-urgent">
                            {user.mergedIntoId ? t('admin.contacts.mergedBadge') : t('admin.users.deactivated')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{user.email}</td>
                      <td className="px-4 py-3 text-ink-muted">{t(`userRole.${user.role}`)}</td>
                      <td className="px-4 py-3 text-ink-muted">
                        {user.permissionGroupId ? (groupNameById.get(user.permissionGroupId) ?? '…') : '—'}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{formatDate(user.createdAt)}</td>
                      {isAdmin && (
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingUser(user)}
                              disabled={blockedByRestriction}
                              title={blockedByRestriction ? t('admin.users.restrictedAdminHint') : t('admin.users.edit')}
                              aria-label={t('admin.users.editAria', { name: user.fullName })}
                              className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-muted hover:text-brand-600 disabled:opacity-30"
                            >
                              ✎
                            </button>
                            {/* Not shown for your own row — resetting your OWN
                                2FA needs the currentPassword/TOTP re-auth the
                                backend now requires for self-targeting (see
                                UsersService.resetTwoFactorByAdmin), which this
                                button never collects. «Мои настройки → Security»
                                already has a safe self-service disable flow. */}
                            {user.twoFactorEnabled && !isSelf && (
                              <button
                                type="button"
                                onClick={() => handleResetTwoFactor(user)}
                                disabled={blockedByRestriction || resetTwoFactor.isPending}
                                title={blockedByRestriction ? t('admin.users.restrictedAdminHint') : t('admin.users.resetTwoFactor')}
                                aria-label={t('admin.users.resetTwoFactorAria', { name: user.fullName })}
                                className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-muted hover:text-brand-600 disabled:opacity-50"
                              >
                                <span role="img" aria-label={t('admin.users.resetTwoFactor')}>
                                  🔐
                                </span>
                              </button>
                            )}
                            {isDeactivated ? (
                              <button
                                type="button"
                                onClick={() => reactivate.mutate(user.id)}
                                disabled={blockedByRestriction || reactivate.isPending}
                                title={blockedByRestriction ? t('admin.users.restrictedAdminHint') : t('admin.users.restore')}
                                aria-label={t('admin.users.restoreAria', { name: user.fullName })}
                                className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-muted hover:text-brand-600 disabled:opacity-50"
                              >
                                ↺
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDeactivate(user)}
                                disabled={isSelf || blockedByRestriction || deactivate.isPending}
                                title={
                                  isSelf
                                    ? t('admin.users.cannotDeactivateSelf')
                                    : blockedByRestriction
                                      ? t('admin.users.restrictedAdminHint')
                                      : t('admin.users.deactivate')
                                }
                                aria-label={t('admin.users.deactivateAria', { name: user.fullName })}
                                className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-muted hover:text-priority-urgent disabled:opacity-30"
                              >
                                🗑
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {visibleUsers.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-ink-faint">
                      {t('admin.users.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle px-4 py-2.5">
              <span className="text-[12.5px] text-ink-faint">
                {t('admin.users.pageRange', {
                  from: visibleUsers.length === 0 ? 0 : pageIndex * pageSize + 1,
                  to: pageIndex * pageSize + visibleUsers.length,
                })}
              </span>
              <div className="flex-1" />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={goToPrevPage}
                  disabled={!hasPrevPage || isFetching}
                  className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-40"
                >
                  {t('admin.users.prevPage')}
                </button>
                <button
                  type="button"
                  onClick={goToNextPage}
                  disabled={!hasNextPage || isFetching}
                  className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-40"
                >
                  {t('admin.users.nextPage')}
                </button>
              </div>
              <label className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
                {t('admin.users.pageSizeLabel')}
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])}
                  className="rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[12.5px] text-ink-muted outline-none"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}
      </div>

      {isCreateOpen && <CreateUserModal onClose={() => setCreateOpen(false)} />}
      {isDuplicatesOpen && <DuplicateContactsModal onClose={() => setDuplicatesOpen(false)} />}
      {editingUser && (
        <EditUserModal user={editingUser} canEditRole={editingUser.id !== me?.id} onClose={() => setEditingUser(null)} />
      )}
    </div>
  );
}
