import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useKnowledgeTheme, useUpdateKnowledgeTheme } from '../hooks/useKnowledgeTheme.js';
import { getErrorMessage } from '../lib/errors.js';

// Admin-only (SettingsModal gates the nav entry, backend enforces it too on
// both GET and PATCH — see knowledge-theme.controller.ts). One form, one
// Save button — both fields always submitted together rather than as
// independent per-field patches.
export default function KnowledgeThemeSettingsPage() {
  const { t } = useTranslation();
  const { data: theme, isLoading } = useKnowledgeTheme();
  const updateTheme = useUpdateKnowledgeTheme();
  const [customCss, setCustomCss] = useState('');
  const [customJs, setCustomJs] = useState('');

  useEffect(() => {
    if (theme) {
      setCustomCss(theme.customCss ?? '');
      setCustomJs(theme.customJs ?? '');
    }
  }, [theme]);

  function handleSave() {
    updateTheme.mutate({ customCss, customJs });
  }

  const errorMessage = updateTheme.error ? getErrorMessage(updateTheme.error) : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-none flex-wrap items-center justify-between gap-2 px-4 pb-3.5 pt-4 sm:px-6">
        <div>
          <div className="font-display text-lg font-bold">{t('admin.knowledgeTheme.title')}</div>
          <div className="mt-0.5 text-[12.5px] text-ink-subtle">{t('admin.knowledgeTheme.subtitle')}</div>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={updateTheme.isPending || isLoading}
          className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
        >
          {updateTheme.isPending ? t('common.saving') : t('common.save')}
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6 sm:px-6">
        {isLoading && <div className="py-16 text-center text-sm text-ink-subtle">{t('common.loading')}</div>}

        {!isLoading && (
          <div className="flex max-w-2xl flex-col gap-4">
            <div className="rounded-2xl border border-border bg-surface-card p-4">
              <label htmlFor="custom-css" className="mb-1 block text-[13.5px] font-medium">
                {t('admin.knowledgeTheme.cssLabel')}
              </label>
              <div className="mb-2 text-[12px] text-ink-faint">{t('admin.knowledgeTheme.cssHint')}</div>
              <textarea
                id="custom-css"
                rows={10}
                value={customCss}
                onChange={(e) => setCustomCss(e.target.value)}
                placeholder=".faq-header { background: #0b3d2e; }"
                spellCheck={false}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[12.5px] outline-none focus:border-brand-600"
              />
            </div>

            <div className="rounded-2xl border border-border bg-surface-card p-4">
              <label htmlFor="custom-js" className="mb-1 block text-[13.5px] font-medium">
                {t('admin.knowledgeTheme.jsLabel')}
              </label>
              <div className="mb-2 text-[12px] text-priority-medium">{t('admin.knowledgeTheme.jsWarning')}</div>
              <textarea
                id="custom-js"
                rows={10}
                value={customJs}
                onChange={(e) => setCustomJs(e.target.value)}
                placeholder="console.log('faq loaded');"
                spellCheck={false}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[12.5px] outline-none focus:border-brand-600"
              />
            </div>

            {updateTheme.isSuccess && (
              <div className="text-[12px] text-status-open">{t('admin.knowledgeTheme.saved')}</div>
            )}
            {errorMessage && (
              <p className="rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{errorMessage}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
