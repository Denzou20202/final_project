import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CsatQuestionModal } from '../components/settings/CsatQuestionModal.js';
import { useCsatQuestions, useDeleteCsatQuestion, useUpdateCsatQuestion } from '../hooks/useCsatQuestions.js';
import { getErrorMessage } from '../lib/errors.js';
import type { PublicCsatQuestion } from '../lib/types.js';

// Admin-only (matches csat/questions' @Roles(ADMIN) on the backend) — unlike
// MacrosPage, there's no operator-level access here, so this page is only
// ever reachable through SettingsModal's adminOnly-gated nav entry.
export default function CsatQuestionsSettingsPage() {
  const { t } = useTranslation();
  const { data: questions, isLoading } = useCsatQuestions();
  const updateQuestion = useUpdateCsatQuestion();
  const deleteQuestion = useDeleteCsatQuestion();
  const [editingQuestion, setEditingQuestion] = useState<PublicCsatQuestion | 'new' | null>(null);

  const sorted = [...(questions ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  function handleDelete(question: PublicCsatQuestion) {
    if (!window.confirm(t('admin.csatQuestions.deleteConfirm', { text: question.text }))) return;
    deleteQuestion.mutate(question.id);
  }

  function toggleEnabled(question: PublicCsatQuestion) {
    updateQuestion.mutate({ id: question.id, isEnabled: !question.isEnabled });
  }

  // Swaps sortOrder with the neighbor at delta (-1 up / +1 down) — the list
  // is already sorted by sortOrder, so the visual neighbor is the logical one.
  function move(question: PublicCsatQuestion, delta: number) {
    const index = sorted.findIndex((q) => q.id === question.id);
    const neighbor = sorted[index + delta];
    if (!neighbor) return;
    updateQuestion.mutate({ id: question.id, sortOrder: neighbor.sortOrder });
    updateQuestion.mutate({ id: neighbor.id, sortOrder: question.sortOrder });
  }

  const actionError = deleteQuestion.error
    ? getErrorMessage(deleteQuestion.error)
    : updateQuestion.error
      ? getErrorMessage(updateQuestion.error)
      : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-none flex-wrap items-center justify-between gap-2 px-4 pb-3.5 pt-4 sm:px-6">
        <div>
          <div className="font-display text-lg font-bold">{t('admin.csatQuestions.title')}</div>
          <div className="mt-0.5 text-[12.5px] text-ink-subtle">{t('admin.csatQuestions.subtitle')}</div>
        </div>
        <button
          type="button"
          onClick={() => setEditingQuestion('new')}
          className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover"
        >
          {t('admin.csatQuestions.newQuestion')}
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6 sm:px-6">
        {isLoading && <div className="py-16 text-center text-sm text-ink-subtle">{t('common.loading')}</div>}

        {actionError && (
          <p className="mb-3 rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{actionError}</p>
        )}

        {!isLoading && sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface-card py-16 text-center">
            <div className="font-display text-sm font-semibold text-ink-muted">{t('admin.csatQuestions.empty')}</div>
          </div>
        )}

        {!isLoading && sorted.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface-card">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2.5 font-bold">{t('admin.csatQuestions.columnText')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('admin.csatQuestions.columnEnabled')}</th>
                  <th className="px-4 py-2.5 font-bold" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((question, index) => (
                  <tr
                    key={question.id}
                    onClick={() => setEditingQuestion(question)}
                    className="cursor-pointer border-b border-border-subtle text-[13.5px] last:border-0 hover:bg-surface-muted"
                  >
                    <td className="max-w-md px-4 py-3 font-medium">{question.text}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => toggleEnabled(question)}
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          question.isEnabled ? 'bg-status-open/15 text-status-open' : 'bg-surface-muted text-ink-faint'
                        }`}
                      >
                        {question.isEnabled ? t('admin.csatQuestions.yes') : t('admin.csatQuestions.no')}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => move(question, -1)}
                        disabled={index === 0}
                        aria-label={t('admin.csatQuestions.moveUpAria', { text: question.text })}
                        className="rounded px-1 text-[13px] text-ink-faint hover:text-brand-600 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(question, 1)}
                        disabled={index === sorted.length - 1}
                        aria-label={t('admin.csatQuestions.moveDownAria', { text: question.text })}
                        className="ml-1 rounded px-1 text-[13px] text-ink-faint hover:text-brand-600 disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingQuestion(question)}
                        className="ml-3 text-[12.5px] font-medium text-brand-600 hover:underline"
                      >
                        {t('admin.csatQuestions.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(question)}
                        className="ml-3 text-[12.5px] font-medium text-priority-urgent hover:underline"
                      >
                        {t('admin.csatQuestions.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingQuestion && (
        <CsatQuestionModal
          existing={editingQuestion === 'new' ? undefined : editingQuestion}
          onClose={() => setEditingQuestion(null)}
        />
      )}
    </div>
  );
}
