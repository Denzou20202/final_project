import { useTranslation } from 'react-i18next';
import { toIntlLocale } from '../../lib/format.js';
import type { PublicCsatSubmittedAnswer } from '../../lib/types.js';

function formatDateTime(iso: string, language: string): string {
  return new Date(iso).toLocaleString(toIntlLocale(language), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Same fixed red->green palette as ScorePicker (CsatModal.tsx) and
// operator-app's CsatSection.tsx — another deliberate one-off copy of the
// same 5-step gradient, not a shared token.
const SCORE_COLORS = ['#EF4444', '#F97316', '#EAB308', '#84CC16', '#22C55E'];

function ScoreDot({ score }: { score: number }) {
  return (
    <span
      style={{ backgroundColor: SCORE_COLORS[score - 1] }}
      className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[12px] font-bold text-white"
    >
      {score}
    </span>
  );
}

export function CsatSummary({
  answers,
  submittedAt,
}: {
  answers: PublicCsatSubmittedAnswer[];
  submittedAt: string | null | undefined;
}) {
  const { t, i18n } = useTranslation();
  return (
    <div className="flex-none border-b border-border bg-surface-muted px-6 py-3">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{t('csat.title')}</div>
      <div className="flex flex-col gap-2">
        {answers.map((answer, index) => (
          <div key={index} className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] text-ink-muted">{answer.questionText}</span>
            <ScoreDot score={answer.score} />
          </div>
        ))}
      </div>
      {submittedAt && (
        <p className="mt-1 text-[11px] text-ink-faint">{t('csat.submittedAt', { date: formatDateTime(submittedAt, i18n.language) })}</p>
      )}
    </div>
  );
}
