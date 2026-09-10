import type { UserRole } from '@veloxdesk/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useCreateUser } from '../../hooks/useUsers.js';
import { getErrorMessage } from '../../lib/errors.js';
import { ROLE_LABELS } from '../../lib/labels.js';

type FormValues = {
  fullName: string;
  email: string;
  password: string;
  role: 'client' | 'operator' | 'admin';
  cannotManageAdmins: boolean;
  isVip: boolean;
};

export function CreateUserModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const createUser = useCreateUser();
  // Rebuilt on language change so validation messages follow the active
  // locale — a module-level schema would freeze at whatever language was
  // active on first import.
  const schema = useMemo(
    () =>
      z.object({
        fullName: z.string().min(1, t('admin.users.fullNameRequired')),
        email: z.string().email(t('admin.users.emailInvalid')),
        password: z.string().min(8, t('admin.users.passwordMinLength')),
        role: z.enum(['client', 'operator', 'admin']),
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
    defaultValues: { role: 'operator', cannotManageAdmins: false, isVip: false },
  });
  const selectedRole = watch('role');

  const onSubmit = (values: FormValues) => {
    createUser.mutate(
      {
        ...values,
        role: values.role as UserRole,
        cannotManageAdmins: values.role === 'admin' ? values.cannotManageAdmins : undefined,
        isVip: values.role === 'client' ? values.isVip : undefined,
      },
      { onSuccess: onClose },
    );
  };

  const errorMessage = createUser.error ? getErrorMessage(createUser.error) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="h-full w-full overflow-y-auto bg-surface-card p-6 shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl sm:border sm:border-border">
        <h2 className="mb-4 font-display text-base font-bold">{t('admin.users.newUserTitle')}</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
          <div>
            <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.users.fullNameLabel')}
            </label>
            <input
              id="fullName"
              autoComplete="name"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
              {...register('fullName')}
            />
            {errors.fullName && <p className="mt-1 text-xs text-priority-urgent">{errors.fullName.message}</p>}
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.users.emailLabel')}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="off"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
              {...register('email')}
            />
            {errors.email && <p className="mt-1 text-xs text-priority-urgent">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.users.passwordLabel')}
            </label>
            <input
              id="password"
              type="text"
              autoComplete="off"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
              {...register('password')}
            />
            {errors.password && <p className="mt-1 text-xs text-priority-urgent">{errors.password.message}</p>}
            <p className="mt-1 text-[11px] text-ink-faint">{t('admin.users.createPasswordHint')}</p>
          </div>

          <div>
            <label htmlFor="role" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.users.roleLabel')}
            </label>
            <select
              id="role"
              className="w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600"
              {...register('role')}
            >
              {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                <option key={role} value={role}>
                  {t(`userRole.${role}`)}
                </option>
              ))}
            </select>
          </div>

          {selectedRole === 'admin' && (
            <label className="flex items-start gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm">
              <input type="checkbox" className="mt-0.5" {...register('cannotManageAdmins')} />
              <span>
                <span className="block font-medium text-ink">{t('admin.users.restrictedAdminLabel')}</span>
                <span className="block text-[11.5px] text-ink-faint">{t('admin.users.restrictedAdminHint')}</span>
              </span>
            </label>
          )}

          {selectedRole === 'client' && (
            <label className="flex items-start gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm">
              <input type="checkbox" className="mt-0.5" {...register('isVip')} />
              <span>
                <span className="block font-medium text-ink">{t('admin.users.vipLabel')}</span>
                <span className="block text-[11.5px] text-ink-faint">{t('admin.users.vipHint')}</span>
              </span>
            </label>
          )}

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
              disabled={createUser.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
            >
              {createUser.isPending ? t('admin.users.creating') : t('admin.users.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
