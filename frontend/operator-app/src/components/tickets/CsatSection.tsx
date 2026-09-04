import type { PublicTicketStatus } from '@veloxdesk/types';
import { useTranslation } from 'react-i18next';
import { useCsat } from '../../hooks/useTickets.js';
import { formatDateTime } from '../../lib/format.js';

// Same fixed red->green palette as client-portal's CsatModal — kept as its
// own copy rather than a shared lib since it's a one-off 5-step gradient,
// not a design token used elsewhere.
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

// Read-only for operators/admins — only the client can submit (see
// CsatModal.tsx in client-portal); nothing here ever calls useSubmitCsat.
export function CsatSection({ ticketId, status }: { ticketId: string; status: PublicTicketStatus }) {
  const { t, i18n } = useTranslation();
  const isClosed = status.isClosed;
  const { data: csat } = useCsat(ticketId, isClosed);

  if (!isClosed || !csat || csat.status === 'not_available') return null;

  return (
    <div className="border-b border-border p-4">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{t('csat.title')}</div>
      {csat.status === 'pending' && <p className="text-[12.5px] text-ink-faint">{t('csat.awaitingClient')}</p>}
      {csat.status === 'submitted' && (
        <div className="flex flex-col gap-2">
          {(csat.answers ?? []).map((answer, index) => (
            <div key={index} className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] text-ink-muted">{answer.questionText}</span>
              <ScoreDot score={answer.score} />
            </div>
          ))}
          {csat.submittedAt && (
            <p className="mt-1 text-[11px] text-ink-faint">
              {t('csat.submittedAt', { date: formatDateTime(csat.submittedAt, i18n.language) })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
