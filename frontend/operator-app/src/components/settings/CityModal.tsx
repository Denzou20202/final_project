import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateCity, useRenameCity } from '../../hooks/useCities.js';
import { getErrorMessage } from '../../lib/errors.js';
import type { PublicCity } from '../../lib/types.js';

export function CityModal({ existing, onClose }: { existing: PublicCity | undefined; onClose: () => void }) {
  const { t } = useTranslation();
  const createCity = useCreateCity();
  const renameCity = useRenameCity();
  const [name, setName] = useState(existing?.name ?? '');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (existing) {
      renameCity.mutate({ id: existing.id, name: trimmed }, { onSuccess: onClose });
    } else {
      createCity.mutate(trimmed, { onSuccess: onClose });
    }
  }

  const mutation = existing ? renameCity : createCity;
  const errorMessage = mutation.error ? getErrorMessage(mutation.error) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="flex h-full w-full flex-col overflow-y-auto bg-surface-card p-6 shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl sm:border sm:border-border">
        <h2 className="mb-4 font-display text-base font-bold">
          {existing ? t('admin.cities.editTitle') : t('admin.cities.newTitle')}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
          <div>
            <label htmlFor="city-name" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.cities.nameLabel')}
            </label>
            <input
              id="city-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
            />
            {!name.trim() && <p className="mt-1 text-xs text-ink-faint">{t('admin.cities.nameRequired')}</p>}
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
