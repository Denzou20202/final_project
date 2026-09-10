import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CompanyModal } from '../components/settings/CompanyModal.js';
import { useCurrentUser } from '../hooks/useAuth.js';
import { useCompanies, useDeleteCompany } from '../hooks/useCompanies.js';
import { getErrorMessage } from '../lib/errors.js';
import type { PublicCompany } from '../lib/types.js';

export default function CompaniesSettingsPage() {
  const { t } = useTranslation();
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'admin';
  const { data: companies, isLoading } = useCompanies();
  const deleteCompany = useDeleteCompany();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<PublicCompany | null>(null);

  function handleDelete(company: PublicCompany) {
    if (!window.confirm(t('admin.companies.deleteConfirm', { name: company.name }))) return;
    deleteCompany.mutate(company.id);
  }

  const deleteError = deleteCompany.error ? getErrorMessage(deleteCompany.error) : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-none flex-wrap items-center justify-between gap-2 px-4 pb-3.5 pt-4 sm:px-6">
        <div>
          <div className="font-display text-lg font-bold">{t('admin.companies.title')}</div>
          <div className="mt-0.5 text-[12.5px] text-ink-subtle">{t('admin.companies.subtitle')}</div>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover"
          >
            {t('admin.companies.newCompany')}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6 sm:px-6">
        {isLoading && <div className="py-16 text-center text-sm text-ink-subtle">{t('common.loading')}</div>}

        {deleteError && (
          <p className="mb-3 rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{deleteError}</p>
        )}

        {!isLoading && (companies ?? []).length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface-card py-16 text-center">
            <div className="font-display text-sm font-semibold text-ink-muted">{t('admin.companies.empty')}</div>
          </div>
        )}

        {!isLoading && (companies?.length ?? 0) > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface-card">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2.5 font-bold">{t('admin.companies.columnName')}</th>
                  {isAdmin && <th className="px-4 py-2.5 font-bold" />}
                </tr>
              </thead>
              <tbody>
                {(companies ?? []).map((company) => (
                  <tr
                    key={company.id}
                    onClick={isAdmin ? () => setEditingCompany(company) : undefined}
                    className={`border-b border-border-subtle text-[13.5px] last:border-0 ${isAdmin ? 'cursor-pointer hover:bg-surface-muted' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium">{company.name}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setEditingCompany(company)}
                          className="text-[12.5px] font-medium text-brand-600 hover:underline"
                        >
                          {t('admin.companies.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(company)}
                          className="ml-3 text-[12.5px] font-medium text-priority-urgent hover:underline"
                        >
                          {t('admin.companies.delete')}
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

      {isCreateOpen && <CompanyModal existing={undefined} onClose={() => setCreateOpen(false)} />}
      {editingCompany && <CompanyModal existing={editingCompany} onClose={() => setEditingCompany(null)} />}
    </div>
  );
}
