import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDuplicateContacts, useMergeContacts } from '../../hooks/useContacts.js';
import { formatDateTime } from '../../lib/format.js';
import { getErrorMessage } from '../../lib/errors.js';
import type { PublicDuplicateGroup, PublicUser } from '../../lib/types.js';

function DuplicateGroupCard({ group }: { group: PublicDuplicateGroup }) {
  const { t, i18n } = useTranslation();
  const mergeContacts = useMergeContacts();
  // Earliest-created contact defaults as the surviving record — usually the
  // "original" — the admin can repoint the radio to any other member.
  const [primaryId, setPrimaryId] = useState(group.contacts[0]?.id ?? '');
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(group.contacts.filter((c) => c.id !== group.contacts[0]?.id).map((c) => c.id)),
  );

  function toggleChecked(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handlePrimaryChange(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.delete(id);
      // The previous primary was never itself "checked" (it's excluded from
      // duplicateIds by definition while it holds the radio) — without
      // re-adding it here, switching the radio silently dropped it from the
      // merge entirely instead of demoting it to "just another duplicate".
      next.add(primaryId);
      return next;
    });
    setPrimaryId(id);
  }

  const duplicateIds = [...checked].filter((id) => id !== primaryId);
  const error = mergeContacts.error ? getErrorMessage(mergeContacts.error) : undefined;

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        {t('admin.contacts.matchedOnLabel')}
        {group.matchedOn.map((signal) => (
          <span key={signal} className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-700">
            {t(`admin.contacts.matchSignal.${signal}`)}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        {group.contacts.map((contact: PublicUser) => (
          <label
            key={contact.id}
            className="flex items-start gap-2.5 rounded-lg border border-border-subtle px-2.5 py-2 text-[13px]"
          >
            <input
              type="radio"
              name={`primary-${group.groupId}`}
              checked={primaryId === contact.id}
              onChange={() => handlePrimaryChange(contact.id)}
              className="mt-0.5 accent-brand-600"
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2">
                <span className="font-medium">{contact.fullName}</span>
                <span className="text-ink-faint">{contact.email}</span>
                {contact.phone && <span className="text-ink-faint">{contact.phone}</span>}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-ink-faint">
                {contact.company && <span>{contact.company}</span>}
                <span>{t('admin.contacts.registeredOn', { date: formatDateTime(contact.createdAt, i18n.language) })}</span>
              </span>
            </span>
            {primaryId !== contact.id && (
              <input
                type="checkbox"
                checked={checked.has(contact.id)}
                onChange={() => toggleChecked(contact.id)}
                title={t('admin.contacts.includeInMergeAria')}
                className="mt-0.5 h-4 w-4 rounded border-border accent-brand-600"
              />
            )}
          </label>
        ))}
      </div>

      {error && <p className="mt-2 text-xs text-priority-urgent">{error}</p>}

      <div className="mt-2.5 flex justify-end">
        <button
          type="button"
          disabled={duplicateIds.length === 0 || mergeContacts.isPending}
          onClick={() => mergeContacts.mutate({ primaryId, duplicateIds })}
          className="rounded-lg bg-brand-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {mergeContacts.isPending ? t('admin.contacts.merging') : `${t('admin.contacts.mergeButton')} (${duplicateIds.length})`}
        </button>
      </div>
    </div>
  );
}

export function DuplicateContactsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { data: groups, isLoading } = useDuplicateContacts(true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="flex h-full w-full flex-col bg-surface-card p-6 shadow-lg sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-border">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-base font-bold">{t('admin.contacts.duplicatesTitle')}</h2>
          <button type="button" onClick={onClose} className="text-ink-faint hover:text-ink-muted" aria-label={t('common.close')}>
            ✕
          </button>
        </div>
        <p className="mb-4 text-[12.5px] text-ink-subtle">{t('admin.contacts.duplicatesSubtitle')}</p>

        <div className="flex-1 overflow-y-auto">
          {isLoading && <div className="py-10 text-center text-sm text-ink-subtle">{t('common.loading')}</div>}

          {!isLoading && (groups ?? []).length === 0 && (
            <div className="rounded-xl border border-border bg-surface-muted py-10 text-center text-[13px] text-ink-faint">
              {t('admin.contacts.noDuplicates')}
            </div>
          )}

          {!isLoading && (groups ?? []).length > 0 && (
            <div className="flex flex-col gap-3">
              {(groups ?? []).map((group) => (
                <DuplicateGroupCard key={group.groupId} group={group} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
