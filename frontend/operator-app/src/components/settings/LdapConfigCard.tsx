import { AuthAudience, UserRole } from '@veloxdesk/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useLdapConfig, useTestLdapConnection, useUpsertLdapConfig } from '../../hooks/useLdapConfig.js';
import { getErrorMessage } from '../../lib/errors.js';
import { Field, inputClass, TestStatus } from './DirectoryAuthFormControls.js';

type FormValues = {
  url: string;
  bindDn: string;
  bindPassword: string;
  searchBase: string;
  userFilterTemplate: string;
  emailAttribute: string;
  fullNameAttribute: string;
  externalIdAttribute: string;
  tlsRejectUnauthorized: boolean;
  defaultRole: UserRole;
  enabled: boolean;
};

const DEFAULT_FILTER =
  '(&(objectClass=user)(|(sAMAccountName={{username}})(userPrincipalName={{username}})(mail={{username}})))';

function rolesForAudience(audience: AuthAudience): UserRole[] {
  return audience === AuthAudience.CLIENT ? [UserRole.CLIENT] : [UserRole.OPERATOR, UserRole.ADMIN];
}

export function LdapConfigCard({ audience }: { audience: AuthAudience }) {
  const { t } = useTranslation();
  const { data: config, isLoading } = useLdapConfig(audience);
  const upsert = useUpsertLdapConfig(audience);
  const test = useTestLdapConnection(audience);
  const roles = rolesForAudience(audience);

  const schema = useMemo(
    () =>
      z.object({
        url: z
          .string()
          .min(1, t('admin.auth.required'))
          .regex(/^ldaps?:\/\//, t('admin.auth.ldapUrlInvalid')),
        bindDn: z.string().min(1, t('admin.auth.required')),
        bindPassword: z.string(),
        searchBase: z.string().min(1, t('admin.auth.required')),
        userFilterTemplate: z.string().min(1, t('admin.auth.required')),
        emailAttribute: z.string().min(1, t('admin.auth.required')),
        fullNameAttribute: z.string().min(1, t('admin.auth.required')),
        externalIdAttribute: z.string().min(1, t('admin.auth.required')),
        tlsRejectUnauthorized: z.boolean(),
        defaultRole: z.nativeEnum(UserRole),
        enabled: z.boolean(),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      url: '',
      bindDn: '',
      bindPassword: '',
      searchBase: '',
      userFilterTemplate: DEFAULT_FILTER,
      emailAttribute: 'mail',
      fullNameAttribute: 'displayName',
      externalIdAttribute: 'objectGUID',
      tlsRejectUnauthorized: true,
      defaultRole: roles[0],
      enabled: false,
    },
  });

  // Config loads asynchronously — RHF's defaultValues only apply at mount,
  // so an explicit reset() is needed once the real (or "doesn't exist yet")
  // config is known.
  useEffect(() => {
    if (isLoading) return;
    reset({
      url: config?.url ?? '',
      bindDn: config?.bindDn ?? '',
      bindPassword: '',
      searchBase: config?.searchBase ?? '',
      userFilterTemplate: config?.userFilterTemplate ?? DEFAULT_FILTER,
      emailAttribute: config?.emailAttribute ?? 'mail',
      fullNameAttribute: config?.fullNameAttribute ?? 'displayName',
      externalIdAttribute: config?.externalIdAttribute ?? 'objectGUID',
      tlsRejectUnauthorized: config?.tlsRejectUnauthorized ?? true,
      defaultRole: config?.defaultRole ?? roles[0],
      enabled: config?.enabled ?? false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, isLoading]);

  const onSubmit = (values: FormValues) => {
    upsert.mutate({
      ...values,
      bindPassword: values.bindPassword || undefined,
    });
  };

  const saveError = upsert.error ? getErrorMessage(upsert.error) : undefined;
  const testError = test.data && !test.data.success ? test.data.error : test.error ? getErrorMessage(test.error) : undefined;

  if (isLoading) {
    return <div className="rounded-2xl border border-border bg-surface-card p-4 text-sm text-ink-subtle">{t('common.loading')}</div>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-card p-4" noValidate>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-bold">{t('admin.auth.ldapTitle')}</h3>
        <label className="flex items-center gap-2 text-[12.5px] font-medium text-ink-muted">
          <input type="checkbox" {...register('enabled')} className="h-4 w-4 rounded border-border" />
          {t('admin.auth.enabled')}
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('admin.auth.ldapUrl')} error={errors.url?.message}>
          <input placeholder="ldaps://dc01.corp.local:636" className={inputClass} {...register('url')} />
        </Field>
        <Field label={t('admin.auth.ldapBindDn')} error={errors.bindDn?.message}>
          <input placeholder="CN=svc-veloxdesk,OU=Service Accounts,DC=corp,DC=local" className={inputClass} {...register('bindDn')} />
        </Field>
        <Field label={t('admin.auth.ldapBindPassword')} error={errors.bindPassword?.message}>
          <input
            type="password"
            placeholder={config?.hasBindPassword ? t('admin.auth.secretSavedPlaceholder') : ''}
            className={inputClass}
            {...register('bindPassword')}
          />
        </Field>
        <Field label={t('admin.auth.ldapSearchBase')} error={errors.searchBase?.message}>
          <input placeholder="OU=Staff,DC=corp,DC=local" className={inputClass} {...register('searchBase')} />
        </Field>
      </div>

      <Field label={t('admin.auth.ldapFilterTemplate')} error={errors.userFilterTemplate?.message}>
        <input className={`${inputClass} font-mono text-[12px]`} {...register('userFilterTemplate')} />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={t('admin.auth.ldapEmailAttribute')} error={errors.emailAttribute?.message}>
          <input className={inputClass} {...register('emailAttribute')} />
        </Field>
        <Field label={t('admin.auth.ldapFullNameAttribute')} error={errors.fullNameAttribute?.message}>
          <input className={inputClass} {...register('fullNameAttribute')} />
        </Field>
        <Field label={t('admin.auth.ldapExternalIdAttribute')} error={errors.externalIdAttribute?.message}>
          <input className={inputClass} {...register('externalIdAttribute')} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-[12.5px] font-medium text-ink-muted">
          <input type="checkbox" {...register('tlsRejectUnauthorized')} className="h-4 w-4 rounded border-border" />
          {t('admin.auth.tlsRejectUnauthorized')}
        </label>

        <label className="flex items-center gap-2 text-[12.5px] font-medium text-ink-muted">
          {t('admin.auth.defaultRole')}
          <select {...register('defaultRole')} className="rounded-lg border border-border bg-surface-card px-2 py-1.5 text-[13px]">
            {roles.map((role) => (
              <option key={role} value={role}>
                {t(`userRole.${role}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <TestStatus
        lastTestSuccessAt={config?.lastTestSuccessAt ?? null}
        lastTestError={config?.lastTestError ?? null}
        testError={testError}
        testSuccess={test.data?.success}
      />

      {saveError && <p className="rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{saveError}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => test.mutate()}
          disabled={test.isPending || isDirty}
          title={isDirty ? t('admin.auth.saveBeforeTestHint') : undefined}
          className="rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-50"
        >
          {test.isPending ? t('admin.auth.testing') : t('admin.auth.testConnection')}
        </button>
        <button
          type="submit"
          disabled={upsert.isPending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
        >
          {upsert.isPending ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </form>
  );
}
