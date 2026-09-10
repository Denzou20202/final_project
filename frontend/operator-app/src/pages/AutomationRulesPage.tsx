import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AutomationRuleModal } from '../components/settings/AutomationRuleModal.js';
import { useCurrentUser } from '../hooks/useAuth.js';
import { useAutomationRules, useDeleteAutomationRule, useUpdateAutomationRule } from '../hooks/useAutomationRules.js';
import { getErrorMessage } from '../lib/errors.js';
import type { PublicAutomationRule } from '../lib/types.js';

export default function AutomationRulesPage() {
  const { t } = useTranslation();
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'admin';
  const { data: rules, isLoading } = useAutomationRules();
  const deleteRule = useDeleteAutomationRule();
  const updateRule = useUpdateAutomationRule();
  const [editingRule, setEditingRule] = useState<PublicAutomationRule | 'new' | null>(null);

  function handleDelete(rule: PublicAutomationRule) {
    if (!window.confirm(t('admin.automation.deleteConfirm', { name: rule.name }))) return;
    deleteRule.mutate(rule.id);
  }

  function toggleEnabled(rule: PublicAutomationRule) {
    updateRule.mutate({ id: rule.id, isEnabled: !rule.isEnabled });
  }

  const deleteError = deleteRule.error ? getErrorMessage(deleteRule.error) : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-none flex-wrap items-center justify-between gap-2 px-4 pb-3.5 pt-4 sm:px-6">
        <div>
          <div className="font-display text-lg font-bold">{t('admin.automation.title')}</div>
          <div className="mt-0.5 text-[12.5px] text-ink-subtle">{t('admin.automation.subtitle')}</div>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setEditingRule('new')}
            className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover"
          >
            {t('admin.automation.newRule')}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6 sm:px-6">
        {isLoading && <div className="py-16 text-center text-sm text-ink-subtle">{t('common.loading')}</div>}

        {deleteError && (
          <p className="mb-3 rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{deleteError}</p>
        )}

        {!isLoading && (rules ?? []).length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface-card py-16 text-center">
            <div className="font-display text-sm font-semibold text-ink-muted">{t('admin.automation.empty')}</div>
          </div>
        )}

        {!isLoading && (rules?.length ?? 0) > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface-card">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2.5 font-bold">{t('admin.automation.columnName')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.automation.columnTrigger')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.automation.columnConditions')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.automation.columnActions')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.automation.columnEnabled')}</th>
                  {isAdmin && <th className="px-4 py-2.5 font-bold" />}
                </tr>
              </thead>
              <tbody>
                {(rules ?? []).map((rule) => (
                  <tr
                    key={rule.id}
                    onClick={isAdmin ? () => setEditingRule(rule) : undefined}
                    className={`border-b border-border-subtle text-[13.5px] last:border-0 ${isAdmin ? 'cursor-pointer hover:bg-surface-muted' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium">{rule.name}</td>
                    <td className="px-4 py-3 text-ink-muted">{t(`automationTrigger.${rule.trigger}`)}</td>
                    <td className="px-4 py-3 text-ink-muted">{rule.conditions.length || '—'}</td>
                    <td className="px-4 py-3 text-ink-muted">{rule.actions.length}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => toggleEnabled(rule)}
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          rule.isEnabled ? 'bg-status-open/15 text-status-open' : 'bg-surface-muted text-ink-faint'
                        }`}
                      >
                        {rule.isEnabled ? t('admin.automation.yes') : t('admin.automation.no')}
                      </button>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setEditingRule(rule)}
                          className="text-[12.5px] font-medium text-brand-600 hover:underline"
                        >
                          {t('admin.automation.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(rule)}
                          className="ml-3 text-[12.5px] font-medium text-priority-urgent hover:underline"
                        >
                          {t('admin.automation.delete')}
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

      {editingRule && (
        <AutomationRuleModal
          existing={editingRule === 'new' ? undefined : editingRule}
          onClose={() => setEditingRule(null)}
        />
      )}
    </div>
  );
}
