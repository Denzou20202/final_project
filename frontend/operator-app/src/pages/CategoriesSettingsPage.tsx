import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CategoryModal } from '../components/settings/CategoryModal.js';
import { useCurrentUser } from '../hooks/useAuth.js';
import { useDeleteTicketCategory, useTicketCategories } from '../hooks/useTicketCategories.js';
import { getErrorMessage } from '../lib/errors.js';
import { pickLocalized } from '../lib/localized.js';
import type { PublicTicketCategory } from '../lib/types.js';

export default function CategoriesSettingsPage() {
  const { t, i18n } = useTranslation();
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'admin';
  const { data: categories, isLoading } = useTicketCategories();
  const deleteCategory = useDeleteTicketCategory();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PublicTicketCategory | null>(null);

  function handleDelete(category: PublicTicketCategory) {
    if (!window.confirm(t('admin.categories.deleteConfirm', { name: category.name }))) return;
    deleteCategory.mutate(category.id);
  }

  const deleteError = deleteCategory.error ? getErrorMessage(deleteCategory.error) : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-none flex-wrap items-center justify-between gap-2 px-4 pb-3.5 pt-4 sm:px-6">
        <div>
          <div className="font-display text-lg font-bold">{t('admin.categories.title')}</div>
          <div className="mt-0.5 text-[12.5px] text-ink-subtle">{t('admin.categories.subtitle')}</div>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover"
          >
            {t('admin.categories.newCategory')}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6 sm:px-6">
        {isLoading && <div className="py-16 text-center text-sm text-ink-subtle">{t('common.loading')}</div>}

        {deleteError && (
          <p className="mb-3 rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{deleteError}</p>
        )}

        {!isLoading && (categories ?? []).length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface-card py-16 text-center">
            <div className="font-display text-sm font-semibold text-ink-muted">{t('admin.categories.empty')}</div>
          </div>
        )}

        {!isLoading && (categories?.length ?? 0) > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface-card">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2.5 font-bold">{t('admin.categories.columnName')}</th>
                  {isAdmin && <th className="px-4 py-2.5 font-bold" />}
                </tr>
              </thead>
              <tbody>
                {(categories ?? []).map((category) => (
                  <tr
                    key={category.id}
                    onClick={isAdmin ? () => setEditingCategory(category) : undefined}
                    className={`border-b border-border-subtle text-[13.5px] last:border-0 ${isAdmin ? 'cursor-pointer hover:bg-surface-muted' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium">{pickLocalized(category.name, category.nameUk, category.nameEn, i18n.language)}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setEditingCategory(category)}
                          className="text-[12.5px] font-medium text-brand-600 hover:underline"
                        >
                          {t('admin.categories.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(category)}
                          className="ml-3 text-[12.5px] font-medium text-priority-urgent hover:underline"
                        >
                          {t('admin.categories.delete')}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isCreateOpen && <CategoryModal existing={undefined} onClose={() => setCreateOpen(false)} />}
      {editingCategory && <CategoryModal existing={editingCategory} onClose={() => setEditingCategory(null)} />}
    </div>
  );
}
