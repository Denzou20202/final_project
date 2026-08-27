import { useTranslation } from 'react-i18next';

// Shared bits between LdapConfigCard and OidcConfigCard — both are
// otherwise-identical "one form, one test-connection action, one saved
// status line" shapes, just for different fields.
export const inputClass = 'w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm outline-none focus:border-brand-600';

export function Field({ label, error, children }: { label: string; error: string | undefined; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[12.5px] font-medium text-ink-muted">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-priority-urgent">{error}</p>}
    </div>
  );
}

export function TestStatus({
  lastTestSuccessAt,
  lastTestError,
  testError,
  testSuccess,
}: {
  lastTestSuccessAt: string | null;
  lastTestError: string | null;
  testError: string | undefined;
  testSuccess: boolean | undefined;
}) {
  const { t } = useTranslation();
  if (testError) {
    return <p className="rounded-lg bg-priority-urgent/10 px-3 py-2 text-[12.5px] text-priority-urgent">{testError}</p>;
  }
  if (testSuccess) {
    return <p className="rounded-lg bg-status-resolved/10 px-3 py-2 text-[12.5px] text-status-resolved">{t('admin.auth.testSuccess')}</p>;
  }
  if (lastTestError) {
    return (
      <p className="rounded-lg bg-priority-urgent/10 px-3 py-2 text-[12.5px] text-priority-urgent">
        {t('admin.auth.lastTestFailed', { error: lastTestError })}
      </p>
    );
  }
  if (lastTestSuccessAt) {
    return (
      <p className="text-[12px] text-ink-faint">
        {t('admin.auth.lastTestSuccess', { date: new Date(lastTestSuccessAt).toLocaleString() })}
      </p>
    );
  }
  return <p className="text-[12px] text-ink-faint">{t('admin.auth.neverTested')}</p>;
}
