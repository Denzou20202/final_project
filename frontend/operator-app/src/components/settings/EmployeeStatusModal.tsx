import { useCallback, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAutoTranslate } from '../../hooks/useAutoTranslate.js';
import { useCreateEmployeeStatus, useUpdateEmployeeStatus } from '../../hooks/useEmployeeStatuses.js';
import { getErrorMessage } from '../../lib/errors.js';
import type { PublicEmployeeStatus } from '../../lib/types.js';

const DEFAULT_COLOR = '#F59E0B';

export function EmployeeStatusModal({ existing, onClose }: { existing: PublicEmployeeStatus | undefined; onClose: () => void }) {
  const { t } = useTranslation();
  const createStatus = useCreateEmployeeStatus();
  const updateStatus = useUpdateEmployeeStatus();
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
  const [color, setColor] = useState(existing?.color ?? DEFAULT_COLOR);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const input = { name: trimmed, nameUk: nameUk.trim(), nameEn: nameEn.trim(), color };
    if (existing) {
      updateStatus.mutate({ id: existing.id, ...input }, { onSuccess: onClose });
    } else {
      createStatus.mutate(input, { onSuccess: onClose });
    }
  }

  const mutation = existing ? updateStatus : createStatus;
  const errorMessage = mutation.error ? getErrorMessage(mutation.error) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="flex h-full w-full flex-col overflow-y-auto bg-surface-card p-6 shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-sm sm:rounded-2xl sm:border sm:border-border">
        <h2 className="mb-4 font-display text-base font-bold">
          {existing ? t('admin.employeeStatuses.editTitle') : t('admin.employeeStatuses.newTitle')}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
          <div>
            <label htmlFor="status-name" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.employeeStatuses.nameLabel')}
            </label>
            <input
              id="status-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder={t('admin.employeeStatuses.namePlaceholder')}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
            />
            {!name.trim() && <p className="mt-1 text-xs text-ink-faint">{t('admin.employeeStatuses.nameRequired')}</p>}
          </div>

          <div>
            <label htmlFor="status-name-uk" className="mb-1 block text-sm font-medium text-ink-muted">
              UK
            </label>
            <input
              id="status-name-uk"
              value={nameUk}
              onChange={(e) => {
                setNameUk(e.target.value);
                setUkEnTouched(true);
              }}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
            />
          </div>

          <div>
            <label htmlFor="status-name-en" className="mb-1 block text-sm font-medium text-ink-muted">
              EN
            </label>
            <input
              id="status-name-en"
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
            <label htmlFor="status-color" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.employeeStatuses.colorLabel')}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="status-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 flex-none cursor-pointer rounded-lg border border-border bg-surface-card p-1"
              />
              <span className="text-[12.5px] text-ink-subtle">{color}</span>
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
