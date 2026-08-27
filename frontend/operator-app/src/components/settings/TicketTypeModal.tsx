import { useCallback, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAutoTranslate } from '../../hooks/useAutoTranslate.js';
import { useCreateTicketType, useUpdateTicketType } from '../../hooks/useTicketTypes.js';
import { getErrorMessage } from '../../lib/errors.js';
import type { PublicTicketType } from '../../lib/types.js';

const DEFAULT_COLOR = '#4C82F7';

export function TicketTypeModal({ existing, onClose }: { existing: PublicTicketType | undefined; onClose: () => void }) {
  const { t } = useTranslation();
  const createType = useCreateTicketType();
  const updateType = useUpdateTicketType();
  const [name, setName] = useState(existing?.name ?? '');
  const [nameUk, setNameUk] = useState(existing?.nameUk ?? '');
  const [nameEn, setNameEn] = useState(existing?.nameEn ?? '');
  // Skips auto-fill once editing an existing custom type — its uk/en may
  // already be deliberately set (or deliberately left blank), and a later
  // tweak to the RU name shouldn't silently overwrite either.
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
  const [isDefault, setIsDefault] = useState(existing?.isDefault ?? false);
  const [weight, setWeight] = useState(existing?.weight ?? 1);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const input = { name: trimmed, nameUk: nameUk.trim(), nameEn: nameEn.trim(), color, isDefault, weight };
    if (existing) {
      updateType.mutate({ id: existing.id, ...input }, { onSuccess: onClose });
    } else {
      createType.mutate(input, { onSuccess: onClose });
    }
  }

  const mutation = existing ? updateType : createType;
  const errorMessage = mutation.error ? getErrorMessage(mutation.error) : undefined;
  // Can't un-default via this checkbox — the catalog must always have
  // exactly one default type, so unsetting one requires making a DIFFERENT
  // type the default instead (backend enforces this atomically — see
  // TicketTypesService.update).
  const defaultLocked = !!existing?.isDefault;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="flex h-full w-full flex-col overflow-y-auto bg-surface-card p-6 shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-sm sm:rounded-2xl sm:border sm:border-border">
        <h2 className="mb-4 font-display text-base font-bold">
          {existing ? t('admin.ticketTypes.editTitle') : t('admin.ticketTypes.newTitle')}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
          <div>
            <label htmlFor="ticket-type-name" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.ticketTypes.nameLabel')}
            </label>
            <input
              id="ticket-type-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder={t('admin.ticketTypes.namePlaceholder')}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
            />
            {!name.trim() && <p className="mt-1 text-xs text-ink-faint">{t('admin.ticketTypes.nameRequired')}</p>}
          </div>

          <div>
            <label htmlFor="ticket-type-name-uk" className="mb-1 block text-sm font-medium text-ink-muted">
              UK
            </label>
            <input
              id="ticket-type-name-uk"
              value={nameUk}
              onChange={(e) => {
                setNameUk(e.target.value);
                setUkEnTouched(true);
              }}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
            />
          </div>

          <div>
            <label htmlFor="ticket-type-name-en" className="mb-1 block text-sm font-medium text-ink-muted">
              EN
            </label>
            <input
              id="ticket-type-name-en"
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
            <label htmlFor="ticket-type-color" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.ticketTypes.colorLabel')}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="ticket-type-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 flex-none cursor-pointer rounded-lg border border-border bg-surface-card p-1"
              />
              <span className="text-[12.5px] text-ink-subtle">{color}</span>
            </div>
          </div>

          <div>
            <label htmlFor="ticket-type-weight" className="mb-1 block text-sm font-medium text-ink-muted">
              {t('admin.ticketTypes.weightLabel')}
            </label>
            <input
              id="ticket-type-weight"
              type="number"
              min={0}
              max={1000}
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand-600"
            />
            <p className="mt-1 text-[11px] text-ink-faint">{t('admin.ticketTypes.weightHint')}</p>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-muted/40 px-3 py-2.5">
            <label className="flex items-center gap-2 text-[13px] text-ink-muted">
              <input
                type="checkbox"
                checked={isDefault}
                disabled={defaultLocked}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              {t('admin.ticketTypes.isDefaultLabel')}
            </label>
            <p className="pl-6 text-[11.5px] text-ink-faint">
              {defaultLocked ? t('admin.ticketTypes.isDefaultLockedHint') : t('admin.ticketTypes.isDefaultHint')}
            </p>
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
