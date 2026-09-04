import type { UserRole } from '@veloxdesk/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useCities } from '../../hooks/useCities.js';
import { useCompanies } from '../../hooks/useCompanies.js';
import { useStatusHistory } from '../../hooks/useEmployeeStatuses.js';
import { useAssignPermissionGroup, usePermissionGroups } from '../../hooks/usePermissionGroups.js';
import { useAssignUserTeam, useTeams } from '../../hooks/useTeams.js';
import {
  useDeleteUser,
  useResetUserPassword,
  useSetAdminRestriction,
  useSetVip,
  useUpdateUserProfile,
  useUpdateUserRole,
} from '../../hooks/useUsers.js';
import { getErrorMessage } from '../../lib/errors.js';
import { toIntlLocale } from '../../lib/format.js';
import { ROLE_LABELS } from '../../lib/labels.js';
import { pickLocalized } from '../../lib/localized.js';
import { LETTERS_ONLY_REGEX, PHONE_REGEX, capitalizeFirst, formatUaPhone } from '../../lib/textValidation.js';
import type { PublicUser } from '../../lib/types.js';

type FormValues = {
  fullName: string;
  computerName: string;
  position: string;
  department: string;
  company: string;
  city: string;
  phone: string;
  role: 'client' | 'operator' | 'admin';
  permissionGroupId: string;
  teamId: string;
  cannotManageAdmins: boolean;
  isVip: boolean;
};

function formatHistoryDate(iso: string, language: string): string {
  return new Date(iso).toLocaleString(toIntlLocale(language), {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Same field set as the «Клиент» panel on a ticket (TicketActionsPanel) —
// this is where that data actually gets entered. Operators are the one
// exception: Должность/Подразделение/Город/Телефон don't apply to staff and
// are hidden, and «Отдел» switches from free text to a single-select over
// real team membership (TeamMemberEntity) — see the isOperator branches below.
export function EditUserModal({ user, canEditRole, onClose }: { user: PublicUser; canEditRole: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const updateProfile = useUpdateUserProfile();
  const updateRole = useUpdateUserRole();
  const assignPermissionGroup = useAssignPermissionGroup();
  const assignTeam = useAssignUserTeam();
  const resetPassword = useResetUserPassword();
  const setAdminRestriction = useSetAdminRestriction();
  const setVip = useSetVip();
  const deleteUser = useDeleteUser();
  const { data: permissionGroups } = usePermissionGroups();
  const { data: teams } = useTeams();
  const { data: companies } = useCompanies();
  const { data: cities } = useCities();
  const { data: statusHistory } = useStatusHistory(user.id);

  // Independent of the profile form below — setting a new password is a
  // distinct, higher-stakes action (the admin must hand it to the user
  // out of band) and shouldn't get silently swept in by "Сохранить" or
  // lost if the rest of the form has a validation error.
  const [isResettingPassword, setResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordResetDone, setPasswordResetDone] = useState(false);

  function handleResetPassword() {
    if (newPassword.length < 8) return;
    resetPassword.mutate(
      { id: user.id, password: newPassword },
      {
        onSuccess: () => {
          setNewPassword('');
          setResettingPassword(false);
          setPasswordResetDone(true);
        },
      },
    );
  }
  // `values` (not `defaultValues`) — permissionGroupId/teamId/company/city
  // are <select>s whose <option>s come from permissionGroups/teams/
  // companies/cities, fetched async. With plain defaultValues, a native
  // <select> that mounts before its matching <option> exists silently falls
  // back to the first option ("— без группы —" / "— без отдела —") and RHF
  // never re-syncs it once the real option shows up a moment later — so an
  // admin who saves quickly can silently strip the user's actual group/
  // department. `values` re-applies whenever this object changes (i.e. once
  // the lists load), fixing that; keepDirtyValues stops it from clobbering
  // fields the admin already typed in if these lists happen to refetch
  // mid-edit.
  //
  // company/city specifically: even with the orphaned-value fallback
  // <option> below, the *first* sync can still target that fallback node.
  // Once companies/cities load, React swaps the fallback for the real
  // matching <option> (a different DOM node with the same value) — a native
  // <select> does not carry "selected" across that swap on its own, so
  // without a second sync afterward the field silently reverts to the
  // placeholder. Including companies/cities here forces that second sync,
  // same as teams/permissionGroups already do for teamId/permissionGroupId.
  const formValues = useMemo<FormValues>(
    () => ({
      fullName: user.fullName,
      computerName: user.computerName ?? '',
      position: user.position ?? '',
      department: user.department ?? '',
      company: user.company ?? '',
      city: user.city ?? '',
      phone: user.phone ?? '',
      role: user.role as FormValues['role'],
      permissionGroupId: user.permissionGroupId ?? '',
      teamId: user.teamId ?? '',
      cannotManageAdmins: user.cannotManageAdmins,
      isVip: user.isVip,
    }),
    // permissionGroups/teams/companies/cities aren't read in the body —
    // they're deps purely to force a new object reference (and thus RHF's
    // `values` re-sync) once those lists finish loading. See the comment
    // above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, permissionGroups, teams, companies, cities],
  );

  // Rebuilt on language change so the validation message follows the
  // active locale — a module-level schema would freeze at whatever
  // language was active on first import.
  const schema = useMemo(
    () =>
      z.object({
        fullName: z.string().min(1, t('admin.users.fullNameRequired')),
        computerName: z.string(),
        position: z.string().refine((v) => v === '' || LETTERS_ONLY_REGEX.test(v), t('admin.users.lettersOnlyError')),
        department: z
          .string()
          .refine((v) => v === '' || LETTERS_ONLY_REGEX.test(v), t('admin.users.lettersOnlyError')),
        company: z.string(),
        city: z.string(),
        phone: z.string().refine((v) => v === '' || PHONE_REGEX.test(v), t('admin.users.phoneFormatError')),
        role: z.enum(['client', 'operator', 'admin']),
        permissionGroupId: z.string(),
        teamId: z.string(),
        cannotManageAdmins: z.boolean(),
        isVip: z.boolean(),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: formValues,
    resetOptions: { keepDirtyValues: true },
  });

  // Live-transform the DOM value before handing the event to RHF's own
  // onChange, mirroring the same trick used for computerName in
  // client-portal's OnboardingModal.
  const { onChange: onPositionChange, ...positionField } = register('position');
  const { onChange: onDepartmentChange, ...departmentField } = register('department');
  const { onChange: onPhoneChange, ...phoneField } = register('phone');

  // Reacts live to the Role select below, not just the user's original
  // role — switching to «Оператор» mid-edit hides the client-org fields
  // and swaps «Отдел» over immediately, before saving.
  const isOperator = watch('role') === 'operator';
  const isAdmin = watch('role') === 'admin';
  const isClient = watch('role') === 'client';

  // Off the user's PERSISTED role, not the live form watch above — deleting
  // is a separate, immediate action, not part of the save flow, so it must
  // reflect what's actually in the database right now. Mirrors the backend
  // check in UsersService.hardDelete: a full (non-restricted) admin can only
  // ever be deactivated, never deleted; canEditRole doubles as "not myself"
  // (see UsersPage, where it's passed in as editingUser.id !== me?.id).
  const isFullAdmin = user.role === 'admin' && !user.cannotManageAdmins;
  const canDelete = canEditRole && !isFullAdmin;
  const deleteBlockedReason = !canEditRole
    ? t('admin.users.cannotDeleteSelf')
    : isFullAdmin
      ? t('admin.users.cannotDeleteFullAdmin')
      : undefined;

  function handleDelete() {
    if (!window.confirm(t('admin.users.deleteConfirm', { name: user.fullName }))) {
      return;
    }
    deleteUser.mutate(user.id, { onSuccess: onClose });
  }

  const onSubmit = async (values: FormValues) => {
    await updateProfile.mutateAsync({
      id: user.id,
      fullName: values.fullName,
      computerName: values.computerName,
      position: values.position,
      department: values.department,
      company: values.company,
      city: values.city,
      phone: values.phone,
    });
    if (canEditRole && values.role !== user.role) {
      await updateRole.mutateAsync({ id: user.id, role: values.role as UserRole });
    }
    const nextGroupId = values.permissionGroupId || null;
    if (nextGroupId !== (user.permissionGroupId ?? null)) {
      await assignPermissionGroup.mutateAsync({ userId: user.id, permissionGroupId: nextGroupId });
    }
    if (values.role === 'operator') {
      const nextTeamId = values.teamId || null;
      if (nextTeamId !== (user.teamId ?? null)) {
        await assignTeam.mutateAsync({ userId: user.id, teamId: nextTeamId });
      }
    }
    if (values.role === 'admin' && values.cannotManageAdmins !== user.cannotManageAdmins) {
      await setAdminRestriction.mutateAsync({ id: user.id, cannotManageAdmins: values.cannotManageAdmins });
    }
    if (values.role === 'client' && values.isVip !== user.isVip) {
      await setVip.mutateAsync({ id: user.id, isVip: values.isVip });
    }
    onClose();
  };

  const errorMessage = updateProfile.error
    ? getErrorMessage(updateProfile.error)
    : updateRole.error
      ? getErrorMessage(updateRole.error)
      : assignPermissionGroup.error
        ? getErrorMessage(assignPermissionGroup.error)
        : assignTeam.error
          ? getErrorMessage(assignTeam.error)
          : setAdminRestriction.error
            ? getErrorMessage(setAdminRestriction.error)
            : setVip.error
              ? getErrorMessage(setVip.error)
              : undefined;
  const isSaving =
    updateProfile.isPending ||
    updateRole.isPending ||
    assignPermissionGroup.isPending ||
    assignTeam.isPending ||
    setAdminRestriction.isPending ||
    setVip.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="h-full w-full overflow-y-auto bg-surface-card p-6 shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl sm:border sm:border-border">
        <h2 className="mb-1 font-display text-base font-bold">{t('admin.users.editTitle')}</h2>
        <p className="mb-4 text-[12.5px] text-ink-subtle">{user.email}</p>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
          <div>
            <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.users.editFullNameLabel')}
            </label>
            <input
              id="fullName"
              autoComplete="name"
              className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
              {...register('fullName')}
            />
            {errors.fullName && <p className="mt-1 text-xs text-priority-urgent">{errors.fullName.message}</p>}
          </div>

          <div>
            <label htmlFor="computerName" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.users.computerNameLabel')}
            </label>
            <input
              id="computerName"
              className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
              {...register('computerName')}
            />
          </div>

          {!isOperator && (
            <div>
              <label htmlFor="position" className="mb-1 block text-sm font-medium text-ink-muted">
                {t('ticketDetail.position')}
              </label>
              <input
                id="position"
                className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
                {...positionField}
                onChange={(e) => {
                  e.target.value = capitalizeFirst(e.target.value);
                  onPositionChange(e);
                }}
              />
              {errors.position && <p className="mt-1 text-xs text-priority-urgent">{errors.position.message}</p>}
            </div>
          )}

          {isOperator ? (
            <div>
              <label htmlFor="teamId" className="mb-1 block text-sm font-medium text-ink-muted">
                {t('ticketFields.team')}
              </label>
              <select
                id="teamId"
                className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
                {...register('teamId')}
              >
                <option value="">{t('admin.users.noTeamOption')}</option>
                {(teams ?? []).map((team) => (
                  <option key={team.id} value={team.id}>
                    {pickLocalized(team.name, team.nameUk, team.nameEn, i18n.language)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="department" className="mb-1 block text-sm font-medium text-ink-muted">
                  {t('ticketDetail.department')}
                </label>
                <input
                  id="department"
                  className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
                  {...departmentField}
                  onChange={(e) => {
                    e.target.value = capitalizeFirst(e.target.value);
                    onDepartmentChange(e);
                  }}
                />
                {errors.department && (
                  <p className="mt-1 text-xs text-priority-urgent">{errors.department.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="company" className="mb-1 block text-sm font-medium text-ink-muted">
                  {t('ticketDetail.company')}
                </label>
                <select
                  id="company"
                  className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
                  {...register('company')}
                  // Explicitly controlled via `watch`, on top of `register`.
                  // A plain register()'d <select> only gets its DOM value set
                  // imperatively once, when RHF's `values` sync effect runs;
                  // when the companies list finishes loading a moment later,
                  // React swaps the fallback <option> below for the real one
                  // from the map (a different DOM node with the same value),
                  // and a native <select> does not carry "selected" across
                  // that swap — nothing re-applies it afterward, so it
                  // silently reverts to the placeholder. Pinning `value` here
                  // makes React re-assert the correct value on every render,
                  // including the one right after that swap.
                  value={watch('company')}
                >
                  <option value="">{t('admin.users.noCompanyOption')}</option>
                  {/* If this user's stored value predates the catalog (or its
                      matching entry was since renamed/removed), it wouldn't
                      appear below — a plain <select> would then silently fall
                      back to the first option and a save would overwrite the
                      real value. Same "keep the current value visible even if
                      stale" fix already used for `assignee` above. */}
                  {user.company && !companies?.some((c) => c.name === user.company) && (
                    <option value={user.company}>{user.company}</option>
                  )}
                  {(companies ?? []).map((company) => (
                    <option key={company.id} value={company.name}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {!isOperator && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="city" className="mb-1 block text-sm font-medium text-ink-muted">
                  {t('ticketDetail.city')}
                </label>
                <select
                  id="city"
                  className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
                  {...register('city')}
                  // See the analogous comment on the «Компания» select above.
                  value={watch('city')}
                >
                  <option value="">{t('admin.users.noCityOption')}</option>
                  {/* See the analogous comment on the «Компания» select above. */}
                  {user.city && !cities?.some((c) => c.name === user.city) && (
                    <option value={user.city}>{user.city}</option>
                  )}
                  {(cities ?? []).map((city) => (
                    <option key={city.id} value={city.name}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="phone" className="mb-1 block text-sm font-medium text-ink-muted">
                  {t('ticketDetail.phone')}
                </label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="+380 00 000-00-00"
                  className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
                  {...phoneField}
                  onChange={(e) => {
                    e.target.value = formatUaPhone(e.target.value);
                    onPhoneChange(e);
                  }}
                />
                {errors.phone && <p className="mt-1 text-xs text-priority-urgent">{errors.phone.message}</p>}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="role" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.users.roleLabel')}
            </label>
            <select
              id="role"
              disabled={!canEditRole}
              className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600 disabled:opacity-60"
              {...register('role')}
            >
              {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                <option key={role} value={role}>
                  {t(`userRole.${role}`)}
                </option>
              ))}
            </select>
            {!canEditRole && <p className="mt-1 text-[11px] text-ink-faint">{t('admin.users.cannotEditOwnRole')}</p>}
          </div>

          {isAdmin && (
            <label className="flex items-start gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm">
              <input
                type="checkbox"
                disabled={!canEditRole}
                className="mt-0.5 disabled:opacity-60"
                {...register('cannotManageAdmins')}
              />
              <span>
                <span className="block font-medium text-ink">{t('admin.users.restrictedAdminLabel')}</span>
                <span className="block text-[11.5px] text-ink-faint">
                  {canEditRole ? t('admin.users.restrictedAdminHint') : t('admin.users.cannotEditOwnRole')}
                </span>
              </span>
            </label>
          )}

          {isClient && (
            <label className="flex items-start gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm">
              <input type="checkbox" className="mt-0.5" {...register('isVip')} />
              <span>
                <span className="block font-medium text-ink">{t('admin.users.vipLabel')}</span>
                <span className="block text-[11.5px] text-ink-faint">{t('admin.users.vipHint')}</span>
              </span>
            </label>
          )}

          <div>
            <label htmlFor="permissionGroupId" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.users.permissionGroupLabel')}
            </label>
            <select
              id="permissionGroupId"
              className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
              {...register('permissionGroupId')}
            >
              <option value="">{t('admin.users.noGroupOption')}</option>
              {(permissionGroups ?? []).map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg border border-border p-3">
            <div className="mb-1 text-sm font-medium text-ink-muted">{t('admin.users.passwordSectionLabel')}</div>
            {/* canEditRole doubles as "not myself" (see its own comment
                above) — resetting your OWN password needs the
                currentPassword/TOTP re-auth the backend now requires for
                self-targeting (UsersService.resetPasswordByAdmin), which
                this quick-reset flow never collects. Point to the safe
                self-service flow in «Мои настройки → Security» instead. */}
            {!canEditRole && <p className="text-[11.5px] text-ink-faint">{t('admin.users.changeOwnPasswordHint')}</p>}
            {canEditRole && !isResettingPassword && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11.5px] text-ink-faint">{t('admin.users.passwordSetByUser')}</p>
                <button
                  type="button"
                  onClick={() => {
                    setResettingPassword(true);
                    setPasswordResetDone(false);
                  }}
                  className="flex-none text-[12.5px] font-medium text-brand-600 hover:underline"
                >
                  {t('admin.users.resetPasswordButton')}
                </button>
              </div>
            )}
            {canEditRole && isResettingPassword && (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  autoComplete="off"
                  autoFocus
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('admin.users.newPasswordPlaceholder')}
                  className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
                />
                {newPassword.length > 0 && newPassword.length < 8 && (
                  <p className="text-xs text-priority-urgent">{t('admin.users.passwordMinLength')}</p>
                )}
                {resetPassword.error && (
                  <p className="text-xs text-priority-urgent">{getErrorMessage(resetPassword.error)}</p>
                )}
                <p className="text-[11px] text-ink-faint">{t('admin.users.resetPasswordHint')}</p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResettingPassword(false);
                      setNewPassword('');
                    }}
                    className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-ink-muted hover:bg-surface-muted"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    disabled={newPassword.length < 8 || resetPassword.isPending}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
                  >
                    {resetPassword.isPending ? t('admin.users.changingPassword') : t('admin.users.setPassword')}
                  </button>
                </div>
              </div>
            )}
            {passwordResetDone && <p className="mt-1 text-[11.5px] text-status-resolved">{t('admin.users.passwordChanged')}</p>}
          </div>

          {statusHistory && statusHistory.length > 0 && (
            <div className="rounded-lg border border-border p-3">
              <div className="mb-1.5 text-sm font-medium text-ink-muted">{t('admin.users.statusHistoryLabel')}</div>
              <div className="max-h-32 overflow-y-auto">
                {statusHistory.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2 py-1 text-[12px]">
                    <span
                      className="h-2 w-2 flex-none rounded-full"
                      style={{ backgroundColor: entry.statusColor ?? '#22C55E' }}
                    />
                    <span className="min-w-0 flex-1 truncate text-ink-muted">{entry.statusName}</span>
                    {entry.automatic && (
                      <span className="flex-none rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] text-ink-faint">
                        {t('admin.users.autoBadge')}
                      </span>
                    )}
                    <span className="flex-none text-[11px] text-ink-faint">{formatHistoryDate(entry.createdAt, i18n.language)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-priority-urgent/20 p-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete || deleteUser.isPending}
              title={deleteBlockedReason}
              aria-label={t('admin.users.deleteAria', { name: user.fullName })}
              className="text-[12.5px] font-medium text-priority-urgent hover:underline disabled:cursor-not-allowed disabled:text-ink-faint disabled:no-underline"
            >
              {deleteUser.isPending ? t('common.saving') : t('admin.users.delete')}
            </button>
            {!canDelete && <p className="mt-1 text-[11px] text-ink-faint">{deleteBlockedReason}</p>}
            {deleteUser.error && (
              <p className="mt-1 text-xs text-priority-urgent">{getErrorMessage(deleteUser.error)}</p>
            )}
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
              disabled={isSaving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
            >
              {isSaving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
