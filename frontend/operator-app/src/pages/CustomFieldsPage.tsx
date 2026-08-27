import { CustomFieldType } from '@veloxdesk/types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomFieldModal } from '../components/settings/CustomFieldModal.js';
import { useCurrentUser } from '../hooks/useAuth.js';
import { useCustomFieldDefinitions, useDeleteCustomFieldDefinition } from '../hooks/useCustomFields.js';
import { pickLocalized } from '../lib/localized.js';
import type { PublicCustomFieldDefinition } from '../lib/types.js';

function detailsFor(field: PublicCustomFieldDefinition): string {
  if (field.fieldType === CustomFieldType.REGEX) return field.pattern ?? '';
  return (field.options ?? []).join(', ');
}

function dependsOnLabel(
  field: PublicCustomFieldDefinition,
  allFields: PublicCustomFieldDefinition[],
  locale: string,
): string | null {
  if (!field.dependsOnFieldId) return null;
  const target = allFields.find((f) => f.id === field.dependsOnFieldId);
  return target ? pickLocalized(target.label, target.labelUk, target.labelEn, locale) : null;
}

export default function CustomFieldsPage() {
  const { t, i18n } = useTranslation();
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'admin';
  const { data: fields, isLoading } = useCustomFieldDefinitions();
  const deleteField = useDeleteCustomFieldDefinition();
  const [editingField, setEditingField] = useState<PublicCustomFieldDefinition | 'new' | null>(null);

  function handleDelete(field: PublicCustomFieldDefinition) {
    if (!window.confirm(t('admin.customFields.deleteConfirm', { label: field.label }))) return;
    deleteField.mutate(field.id);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-none flex-wrap items-center justify-between gap-2 px-4 pb-3.5 pt-4 sm:px-6">
        <div>
          <div className="font-display text-lg font-bold">{t('admin.customFields.title')}</div>
          <div className="mt-0.5 text-[12.5px] text-ink-subtle">{t('admin.customFields.subtitle')}</div>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setEditingField('new')}
            className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover"
          >
            {t('admin.customFields.newField')}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6 sm:px-6">
        {isLoading && <div className="py-16 text-center text-sm text-ink-subtle">{t('common.loading')}</div>}

        {!isLoading && (fields ?? []).length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface-card py-16 text-center">
            <div className="font-display text-sm font-semibold text-ink-muted">{t('admin.customFields.empty')}</div>
          </div>
        )}

        {!isLoading && (fields?.length ?? 0) > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface-card">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2.5 font-bold">{t('admin.customFields.columnName')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.customFields.columnType')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.customFields.columnOptions')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.customFields.columnDependsOn')}</th>
                  {isAdmin && <th className="px-4 py-2.5 font-bold" />}
                </tr>
              </thead>
              <tbody>
                {(fields ?? []).map((field) => (
                  <tr
                    key={field.id}
                    onClick={isAdmin ? () => setEditingField(field) : undefined}
                    className={`border-b border-border-subtle text-[13.5px] last:border-0 ${isAdmin ? 'cursor-pointer hover:bg-surface-muted' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium">{pickLocalized(field.label, field.labelUk, field.labelEn, i18n.language)}</td>
                    <td className="px-4 py-3 text-ink-muted">{t(`customFieldType.${field.fieldType}`)}</td>
                    <td className="max-w-md truncate px-4 py-3 text-ink-muted">{detailsFor(field)}</td>
                    <td className="px-4 py-3 text-ink-muted">
                      {dependsOnLabel(field, fields ?? [], i18n.language) ?? '—'}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setEditingField(field)}
                          className="text-[12.5px] font-medium text-brand-600 hover:underline"
                        >
                          {t('admin.customFields.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(field)}
                          className="ml-3 text-[12.5px] font-medium text-priority-urgent hover:underline"
                        >
                          {t('admin.customFields.delete')}
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

      {editingField && (
        <CustomFieldModal
          existing={editingField === 'new' ? undefined : editingField}
          onClose={() => setEditingField(null)}
        />
      )}
    </div>
  );
}
