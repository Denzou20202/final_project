import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MacroModal } from '../components/settings/MacroModal.js';
import { useDeleteMacro, useMacros } from '../hooks/useMacros.js';
import { getErrorMessage } from '../lib/errors.js';
import { htmlToPlainText } from '../lib/html.js';
import { pickLocalized } from '../lib/localized.js';
import type { PublicMacro } from '../lib/types.js';

// Unlike SLA policies/users, macros are a day-to-day authoring tool for
// whoever's answering tickets — both operators and admins get full CRUD
// here (matches macros.controller.ts, which no longer restricts
// create/update/delete to admin-only). Anyone who reaches this page is
// already staff (ProtectedRoute bounces clients away), so no role check
// is needed at all.
export default function MacrosPage() {
  const { t, i18n } = useTranslation();
  const { data: macros, isLoading } = useMacros();
  const deleteMacro = useDeleteMacro();
  const [editingMacro, setEditingMacro] = useState<PublicMacro | 'new' | null>(null);

  function handleDelete(macro: PublicMacro) {
    if (!window.confirm(t('admin.macros.deleteConfirm', { name: macro.title }))) return;
    deleteMacro.mutate(macro.id);
  }

  const deleteError = deleteMacro.error ? getErrorMessage(deleteMacro.error) : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-none flex-wrap items-center justify-between gap-2 px-4 pb-3.5 pt-4 sm:px-6">
        <div>
          <div className="font-display text-lg font-bold">{t('admin.macros.title')}</div>
          <div className="mt-0.5 text-[12.5px] text-ink-subtle">{t('admin.macros.subtitle')}</div>
        </div>
        <button
          type="button"
          onClick={() => setEditingMacro('new')}
          className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover"
        >
          {t('admin.macros.newMacro')}
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6 sm:px-6">
        {isLoading && <div className="py-16 text-center text-sm text-ink-subtle">{t('common.loading')}</div>}

        {deleteError && (
          <p className="mb-3 rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{deleteError}</p>
        )}

        {!isLoading && (macros ?? []).length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface-card py-16 text-center">
            <div className="font-display text-sm font-semibold text-ink-muted">{t('admin.macros.empty')}</div>
          </div>
        )}

        {!isLoading && (macros?.length ?? 0) > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface-card">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2.5 font-bold">{t('admin.macros.columnName')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.macros.columnText')}</th>
                  <th className="px-4 py-2.5 font-bold" />
                </tr>
              </thead>
              <tbody>
                {(macros ?? []).map((macro) => (
                  <tr
                    key={macro.id}
                    onClick={() => setEditingMacro(macro)}
                    className="cursor-pointer border-b border-border-subtle text-[13.5px] last:border-0 hover:bg-surface-muted"
                  >
                    <td className="px-4 py-3 font-medium">{pickLocalized(macro.title, macro.titleUk, macro.titleEn, i18n.language)}</td>
                    <td className="max-w-md truncate px-4 py-3 text-ink-muted">{htmlToPlainText(macro.body)}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setEditingMacro(macro)}
                        className="text-[12.5px] font-medium text-brand-600 hover:underline"
                      >
                        {t('admin.macros.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(macro)}
                        className="ml-3 text-[12.5px] font-medium text-priority-urgent hover:underline"
                      >
                        {t('admin.macros.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingMacro && (
        <MacroModal
          existing={editingMacro === 'new' ? undefined : editingMacro}
          onClose={() => setEditingMacro(null)}
        />
      )}
    </div>
  );
}
