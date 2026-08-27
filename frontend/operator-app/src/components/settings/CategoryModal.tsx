import { useCallback, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAutoTranslate } from '../../hooks/useAutoTranslate.js';
import { useCreateTicketCategory, useRenameTicketCategory } from '../../hooks/useTicketCategories.js';
import { getErrorMessage } from '../../lib/errors.js';
import type { PublicTicketCategory } from '../../lib/types.js';

export function CategoryModal({
  existing,
  onClose,
}: {
  existing: PublicTicketCategory | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const createCategory = useCreateTicketCategory();
  const renameCategory = useRenameTicketCategory();
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const input = { name: trimmed, nameUk: nameUk.trim(), nameEn: nameEn.trim() };
    if (existing) {
      renameCategory.mutate({ id: existing.id, ...input }, { onSuccess: onClose });
    } else {
      createCategory.mutate(input, { onSuccess: onClose });
    }
  }

  const mutation = existing ? renameCategory : createCategory;
  const errorMessage = mutation.error ? getErrorMessage(mutation.error) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="flex h-full w-full flex-col overflow-y-auto bg-surface-card p-6 shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl sm:border sm:border-border">
        <h2 className="mb-4 font-display text-base font-bold">
          {existing ? t('admin.categories.editTitle') : t('admin.categories.newTitle')}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
          <div>
            <label htmlFor="category-name" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.categories.nameLabel')}
            </label>
            <input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
            />
            {!name.trim() && <p className="mt-1 text-xs text-ink-faint">{t('admin.categories.nameRequired')}</p>}
          </div>

          <div>
            <label htmlFor="category-name-uk" className="mb-1 block text-sm font-medium text-ink-muted">
              UK
            </label>
            <input
              id="category-name-uk"
              value={nameUk}
              onChange={(e) => {
                setNameUk(e.target.value);
                setUkEnTouched(true);
              }}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
            />
          </div>

          <div>
            <label htmlFor="category-name-en" className="mb-1 block text-sm font-medium text-ink-muted">
              EN
            </label>
            <input
              id="category-name-en"
              value={nameEn}
              onChange={(e) => {
                setNameEn(e.target.value);
                setUkEnTouched(true);
              }}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
            />
            <p className="mt-1 text-[11px] text-ink-faint">{t('settings.autoTranslateHint')}</p>
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
