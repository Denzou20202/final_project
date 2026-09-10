import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircleIcon } from '../common/icons.js';
import type { PublicCsatQuestionOption } from '../../lib/types.js';

// Red -> green, one fixed color per score — a deliberate one-off palette
// (not a shared design token) since nothing else in the app needs a
// 5-step satisfaction gradient.
const SCORE_COLORS = ['#EF4444', '#F97316', '#EAB308', '#84CC16', '#22C55E'];

function ScorePicker({ value, onPick, disabled }: { value: number | undefined; onPick: (score: number) => void; disabled: boolean }) {
  return (
    <div className="flex items-center justify-center gap-3">
      {SCORE_COLORS.map((color, index) => {
        const score = index + 1;
        const selected = value === score;
        return (
          <button
            key={score}
            type="button"
            onClick={() => onPick(score)}
            disabled={disabled}
            style={{ backgroundColor: color }}
            className={`flex h-11 w-11 flex-none items-center justify-center rounded-full text-[15px] font-bold text-white transition-transform disabled:opacity-60 ${
              selected ? 'scale-110 ring-2 ring-offset-2 ring-offset-surface-card' : 'hover:scale-105'
            }`}
          >
            {score}
          </button>
        );
      })}
    </div>
  );
}

// All questions shown at once in a scrollable list — any answer can be
// changed as many times as the user likes. Nothing is submitted until the
// "Submit" button is clicked, and that button only enables once every
// question has an answer. This replaced an earlier one-question-per-card
// wizard that auto-advanced (and submitted) on the first click, which gave
// users no way to reconsider a pick.
export function CsatModal({
  questions,
  onSubmit,
  onClose,
}: {
  questions: PublicCsatQuestionOption[];
  onSubmit: (answers: { questionId: string; score: number }[]) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [phase, setPhase] = useState<'asking' | 'submitting' | 'thanks'>('asking');
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && phase !== 'submitting') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, phase]);

  // Auto-dismiss the thank-you screen after a few seconds so the user
  // doesn't have to click "OK" to move on — the button stays as a way to
  // close it early.
  useEffect(() => {
    if (phase !== 'thanks') return;
    const timer = setTimeout(onClose, 2500);
    return () => clearTimeout(timer);
  }, [phase, onClose]);

  const submitting = phase === 'submitting';
  const allAnswered = questions.every((q) => answers[q.id] !== undefined);

  function handlePick(questionId: string, score: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: score }));
  }

  async function handleSubmit() {
    if (!allAnswered || submitting) return;
    setPhase('submitting');
    setError(undefined);
    try {
      await onSubmit(questions.map((q) => ({ questionId: q.id, score: answers[q.id] })));
      setPhase('thanks');
    } catch {
      setError(t('csat.submitError'));
      setPhase('asking');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-surface-card text-center shadow-lg sm:h-auto sm:max-h-[85vh] sm:max-w-md sm:rounded-2xl sm:border sm:border-border">
        {phase === 'thanks' ? (
          <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-6">
            <span className="mb-2 block text-3xl" role="img" aria-label={t('csat.thankYouAria')}>
              🙏
            </span>
            <p className="text-[14px] font-medium text-ink">{t('csat.thankYou')}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover"
            >
              {t('common.close')}
            </button>
          </div>
        ) : (
          <>
            <div className="flex-none border-b border-border px-6 py-4">
              <p className="text-[14px] font-bold text-ink">{t('csat.bannerPrompt')}</p>
              {error && (
                <p className="mt-2 rounded-lg bg-priority-urgent/10 px-3 py-2 text-xs text-priority-urgent">{error}</p>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6">
              <div className="flex flex-col divide-y divide-border">
                {questions.map((q) => {
                  const answered = answers[q.id] !== undefined;
                  return (
                    <div key={q.id} className="flex flex-col items-center gap-3 py-4">
                      <div className="flex items-center gap-1.5">
                        {answered && <CheckCircleIcon className="h-4 w-4 flex-none text-status-resolved" />}
                        <p className="text-[14px] font-medium text-ink">{q.text}</p>
                      </div>
                      <ScorePicker value={answers[q.id]} onPick={(score) => handlePick(q.id, score)} disabled={submitting} />
                      <div className="flex w-full max-w-[220px] justify-between text-[11px] text-ink-faint">
                        <span>{t('csat.scaleLow')}</span>
                        <span>{t('csat.scaleHigh')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex-none border-t border-border px-6 py-4">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!allAnswered || submitting}
                className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-brand-hover disabled:opacity-40"
              >
                {submitting ? t('csat.submitting') : t('csat.submitButton')}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="mt-3 text-[12.5px] text-ink-subtle hover:text-ink disabled:opacity-50"
              >
                {t('common.close')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
