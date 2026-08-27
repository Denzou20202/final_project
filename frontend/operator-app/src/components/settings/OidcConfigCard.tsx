import { AuthAudience, UserRole } from '@veloxdesk/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useOidcConfig, useTestOidcConnection, useUpsertOidcConfig } from '../../hooks/useOidcConfig.js';
import { getErrorMessage } from '../../lib/errors.js';
import { Field, inputClass, TestStatus } from './DirectoryAuthFormControls.js';

type FormValues = {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
  emailClaim: string;
  fullNameClaim: string;
  defaultRole: UserRole;
  enabled: boolean;
};

function rolesForAudience(audience: AuthAudience): UserRole[] {
  return audience === AuthAudience.CLIENT ? [UserRole.CLIENT] : [UserRole.OPERATOR, UserRole.ADMIN];
}

// Suggests the backend endpoint an admin must register as the redirect URI
// in their IdP's app registration — same origin, computed client-side since
// there's no API base URL to ask for it (the browser already knows it).
function suggestedRedirectUri(audience: AuthAudience): string {
  return `${window.location.origin}/api/auth/oidc/${audience}/callback`;
}

export function OidcConfigCard({ audience }: { audience: AuthAudience }) {
  const { t } = useTranslation();
  const { data: config, isLoading } = useOidcConfig(audience);
  const upsert = useUpsertOidcConfig(audience);
  const test = useTestOidcConnection(audience);
  const roles = rolesForAudience(audience);

  const schema = useMemo(
    () =>
      z.object({
        issuerUrl: z
          .string()
          .min(1, t('admin.auth.required'))
          .regex(/^https:\/\//, t('admin.auth.oidcIssuerInvalid')),
        clientId: z.string().min(1, t('admin.auth.required')),
        clientSecret: z.string(),
        redirectUri: z
          .string()
          .min(1, t('admin.auth.required'))
          .regex(/^https?:\/\//, t('admin.auth.oidcRedirectInvalid')),
        scopes: z.string().min(1, t('admin.auth.required')),
        emailClaim: z.string().min(1, t('admin.auth.required')),
        fullNameClaim: z.string().min(1, t('admin.auth.required')),
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
      issuerUrl: '',
      clientId: '',
      clientSecret: '',
      redirectUri: suggestedRedirectUri(audience),
      scopes: 'openid profile email',
      emailClaim: 'email',
      fullNameClaim: 'name',
      defaultRole: roles[0],
      enabled: false,
    },
  });

  useEffect(() => {
    if (isLoading) return;
    reset({
      issuerUrl: config?.issuerUrl ?? '',
      clientId: config?.clientId ?? '',
      clientSecret: '',
      redirectUri: config?.redirectUri ?? suggestedRedirectUri(audience),
      scopes: config?.scopes ?? 'openid profile email',
      emailClaim: config?.emailClaim ?? 'email',
      fullNameClaim: config?.fullNameClaim ?? 'name',
      defaultRole: config?.defaultRole ?? roles[0],
      enabled: config?.enabled ?? false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, isLoading]);

  const onSubmit = (values: FormValues) => {
    upsert.mutate({
      ...values,
      clientSecret: values.clientSecret || undefined,
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
        <h3 className="font-display text-sm font-bold">{t('admin.auth.oidcTitle')}</h3>
        <label className="flex items-center gap-2 text-[12.5px] font-medium text-ink-muted">
          <input type="checkbox" {...register('enabled')} className="h-4 w-4 rounded border-border" />
          {t('admin.auth.enabled')}
        </label>
      </div>

      <Field label={t('admin.auth.oidcIssuerUrl')} error={errors.issuerUrl?.message}>
        <input placeholder="https://login.microsoftonline.com/<tenant-id>/v2.0" className={inputClass} {...register('issuerUrl')} />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('admin.auth.oidcClientId')} error={errors.clientId?.message}>
          <input className={inputClass} {...register('clientId')} />
        </Field>
        <Field label={t('admin.auth.oidcClientSecret')} error={errors.clientSecret?.message}>
          <input
            type="password"
            placeholder={config?.hasClientSecret ? t('admin.auth.secretSavedPlaceholder') : ''}
            className={inputClass}
            {...register('clientSecret')}
          />
        </Field>
      </div>

      <Field label={t('admin.auth.oidcRedirectUri')} error={errors.redirectUri?.message}>
        <input className={`${inputClass} font-mono text-[12px]`} {...register('redirectUri')} />
        <p className="mt-1 text-[11px] text-ink-faint">{t('admin.auth.oidcRedirectUriHint')}</p>
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={t('admin.auth.oidcScopes')} error={errors.scopes?.message}>
          <input className={inputClass} {...register('scopes')} />
        </Field>
        <Field label={t('admin.auth.oidcEmailClaim')} error={errors.emailClaim?.message}>
          <input className={inputClass} {...register('emailClaim')} />
        </Field>
        <Field label={t('admin.auth.oidcFullNameClaim')} error={errors.fullNameClaim?.message}>
          <input className={inputClass} {...register('fullNameClaim')} />
        </Field>
      </div>

      <label className="flex w-fit items-center gap-2 text-[12.5px] font-medium text-ink-muted">
        {t('admin.auth.defaultRole')}
        <select {...register('defaultRole')} className="rounded-lg border border-border bg-surface-card px-2 py-1.5 text-[13px]">
          {roles.map((role) => (
            <option key={role} value={role}>
              {t(`userRole.${role}`)}
            </option>
          ))}
        </select>
      </label>

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
