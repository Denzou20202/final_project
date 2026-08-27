import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useCsatSummary, useDownloadCsatSummaryCsv } from '../../hooks/useReports.js';
import { useTeams } from '../../hooks/useTeams.js';
import { useAssignableUsers } from '../../hooks/useUsers.js';
import { getErrorMessage } from '../../lib/errors.js';
import { endOfLocalDay, formatDateTime, startOfLocalDay, toLocalDateInputValue } from '../../lib/format.js';
import { pickLocalized } from '../../lib/localized.js';

const DEFAULT_PERIOD_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Same fixed red->green palette as the read-only CSAT section on the ticket
// panel and client-portal's rating modal — one-off gradient, not a shared
// design token.
const SCORE_COLORS = ['#EF4444', '#F97316', '#EAB308', '#84CC16', '#22C55E'];

function ScoreBadge({ score }: { score: number }) {
  const rounded = Math.min(5, Math.max(1, Math.round(score)));
  return (
    <span
      style={{ backgroundColor: SCORE_COLORS[rounded - 1] }}
      className="inline-flex min-w-[2.5rem] items-center justify-center rounded-full px-2 py-0.5 text-[12px] font-bold text-white"
    >
      {score.toFixed(1)}
    </span>
  );
}

// Aggregates csat_answers — a different data source than every other hub
// section (which all group `tickets`), so like AuditReportView this doesn't
// reuse ReportFiltersForm, just its own team/operator/date filters.
export function CsatReportView() {
  const { t, i18n } = useTranslation();
  const now = new Date();
  const [from, setFrom] = useState(toLocalDateInputValue(new Date(now.getTime() - DEFAULT_PERIOD_DAYS * MS_PER_DAY)));
  const [to, setTo] = useState(toLocalDateInputValue(now));
  const [teamId, setTeamId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const { data: teams } = useTeams();
  const { data: usersPage } = useAssignableUsers();
  const staff = (usersPage?.items ?? []).filter((u) => u.role !== 'client' && !u.deactivatedAt);
  const summary = useCsatSummary();
  const downloadCsv = useDownloadCsatSummaryCsv();

  function requestArgs() {
    return {
      from: startOfLocalDay(from).toISOString(),
      to: endOfLocalDay(to).toISOString(),
      teamId: teamId || undefined,
      assigneeId: assigneeId || undefined,
    };
  }

  function handleShow() {
    summary.mutate(requestArgs());
  }

  const data = summary.data;
  const runError = summary.error
    ? getErrorMessage(summary.error)
    : downloadCsv.error
      ? getErrorMessage(downloadCsv.error)
      : undefined;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-1 font-display text-lg font-bold">{t('reports.csatTitle')}</div>
      <div className="mb-4 text-[12.5px] text-ink-subtle">{t('reports.csatSubtitle')}</div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-card p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
              {t('ticketFields.team')}
            </label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-600"
            >
              <option value="">{t('reports.all')}</option>
              {(teams ?? []).map((team) => (
                <option key={team.id} value={team.id}>
                  {pickLocalized(team.name, team.nameUk, team.nameEn, i18n.language)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
              {t('ticketFields.assignee')}
            </label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-600"
            >
              <option value="">{t('reports.all')}</option>
              {staff.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
              {t('reports.fromLabel')}
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
              {t('reports.toLabel')}
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-600"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3.5">
          <button
            type="button"
            onClick={handleShow}
            disabled={summary.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {summary.isPending ? t('reports.calculating') : t('reports.show')}
          </button>
          {data && (
            <button
              type="button"
              onClick={() => downloadCsv.mutate(requestArgs())}
              disabled={downloadCsv.isPending}
              className="rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-60"
            >
              {downloadCsv.isPending ? t('analytics.preparing') : t('analytics.exportCsv')}
            </button>
          )}
        </div>
        {runError && <p className="text-xs text-priority-urgent">{runError}</p>}
      </div>

      {data && (
        <>
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-surface-card p-4">
            <div className="text-[12.5px] text-ink-muted">{t('reports.csatOverallAvg')}</div>
            {data.overallAvg !== null ? (
              <ScoreBadge score={data.overallAvg} />
            ) : (
              <span className="text-[12.5px] text-ink-faint">{t('reports.noDataForFilters')}</span>
            )}
            <div className="ml-auto text-[12.5px] text-ink-faint">
              {t('reports.csatTotalResponses', { count: data.totalResponses })}
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface-card">
            <div className="border-b border-border-subtle px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
              {t('reports.csatByQuestion')}
            </div>
            {data.byQuestion.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-ink-faint">{t('reports.noDataForFilters')}</div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                    <th className="px-4 py-2.5 font-bold">{t('reports.csatColumnQuestion')}</th>
                    <th className="px-4 py-2.5 font-bold">{t('reports.csatColumnAvgScore')}</th>
                    <th className="px-4 py-2.5 font-bold">{t('reportColumn.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byQuestion.map((row) => (
                    <tr key={row.questionText} className="border-b border-border-subtle text-[13.5px] last:border-0">
                      <td className="max-w-md px-4 py-3 font-medium">{row.questionText}</td>
                      <td className="px-4 py-3">
                        <ScoreBadge score={row.avgScore} />
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface-card">
            <div className="border-b border-border-subtle px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
              {t('reports.csatByOperator')}
            </div>
            {data.byOperator.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-ink-faint">{t('reports.noDataForFilters')}</div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                    <th className="px-4 py-2.5 font-bold">{t('reports.auditColumnActor')}</th>
                    <th className="px-4 py-2.5 font-bold">{t('reports.csatColumnAvgScore')}</th>
                    <th className="px-4 py-2.5 font-bold">{t('reports.csatColumnPositive')}</th>
                    <th className="px-4 py-2.5 font-bold">{t('reports.csatColumnNegative')}</th>
                    <th className="px-4 py-2.5 font-bold">{t('reportColumn.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byOperator.map((row) => (
                    <tr key={row.assigneeId ?? 'none'} className="border-b border-border-subtle text-[13.5px] last:border-0">
                      <td className="px-4 py-3 font-medium">{row.assigneeName}</td>
                      <td className="px-4 py-3">
                        <ScoreBadge score={row.avgScore} />
                      </td>
                      <td className="px-4 py-3 text-status-open">{row.positiveCount}</td>
                      <td className="px-4 py-3 text-priority-urgent">{row.negativeCount}</td>
                      <td className="px-4 py-3 text-ink-muted">{row.totalCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface-card">
            <div className="border-b border-border-subtle px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
              {t('reports.csatByTicket')}
            </div>
            {data.byTicket.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-ink-faint">{t('reports.noDataForFilters')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                      <th className="px-4 py-2.5 font-bold">{t('reports.csatColumnTicket')}</th>
                      <th className="px-4 py-2.5 font-bold">{t('ticketDetail.client')}</th>
                      <th className="px-4 py-2.5 font-bold">{t('ticketFields.assignee')}</th>
                      <th className="px-4 py-2.5 font-bold">{t('reports.csatColumnRatedAt')}</th>
                      <th className="px-4 py-2.5 font-bold">{t('reports.csatColumnAvgScore')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byTicket.map((row) => (
                      <tr key={row.ticketId} className="border-b border-border-subtle text-[13.5px] last:border-0">
                        <td className="px-4 py-3 font-medium">
                          <Link to={`/tickets/${row.ticketId}`} className="text-brand-600 hover:underline">
                            #{row.ticketNumber}
                          </Link>
                          <span className="ml-2 max-w-xs truncate text-ink-muted">{row.ticketTitle}</span>
                        </td>
                        <td className="px-4 py-3 text-ink-muted">{row.clientName}</td>
                        <td className="px-4 py-3 text-ink-muted">{row.assigneeName || '—'}</td>
                        <td className="px-4 py-3 text-ink-faint">{formatDateTime(row.submittedAt)}</td>
                        <td className="px-4 py-3">
                          <ScoreBadge score={row.avgScore} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
