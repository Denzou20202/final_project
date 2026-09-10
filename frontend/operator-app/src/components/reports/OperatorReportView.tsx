import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDownloadOperatorSummaryCsv, useOperatorSummary } from '../../hooks/useReports.js';
import { useTeams } from '../../hooks/useTeams.js';
import { useTicketStatuses } from '../../hooks/useTicketStatuses.js';
import { getErrorMessage } from '../../lib/errors.js';
import { endOfLocalDay, formatMinutes, startOfLocalDay, toLocalDateInputValue } from '../../lib/format.js';
import { pickLocalized } from '../../lib/localized.js';

const DEFAULT_PERIOD_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Aggregates three different data sources (tickets, employee_status_history,
// and comment-level reply timing) into one per-operator view — like
// CsatReportView/AuditReportView, this doesn't reuse ReportFiltersForm
// (that's ticket-filter-shaped; this is operator-shaped), just its own
// team/date filters. No source/channel filter — the ticket schema has no
// such column to filter by at all (same gap noted on «Отчёт по меткам»).
export function OperatorReportView() {
  const { t, i18n } = useTranslation();
  const now = new Date();
  const [from, setFrom] = useState(toLocalDateInputValue(new Date(now.getTime() - DEFAULT_PERIOD_DAYS * MS_PER_DAY)));
  const [to, setTo] = useState(toLocalDateInputValue(now));
  const [teamId, setTeamId] = useState('');
  const { data: teams } = useTeams();
  const { data: statuses } = useTicketStatuses();
  const summary = useOperatorSummary();
  const downloadCsv = useDownloadOperatorSummaryCsv();

  function requestArgs() {
    return {
      from: startOfLocalDay(from).toISOString(),
      to: endOfLocalDay(to).toISOString(),
      teamId: teamId || undefined,
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
      <div className="mb-1 font-display text-lg font-bold">{t('reports.operatorsTitle')}</div>
      <div className="mb-4 text-[12.5px] text-ink-subtle">{t('reports.operatorsSubtitle')}</div>

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
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface-card">
          {data.rows.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-ink-faint">{t('reports.noDataForFilters')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                    <th className="px-4 py-2.5 font-bold">{t('reportGroupBy.assignee')}</th>
                    <th className="px-4 py-2.5 font-bold">{t('reportColumn.total')}</th>
                    {(statuses ?? []).map((status) => (
                      <th key={status.id} className="px-4 py-2.5 font-bold">
                        {status.key ? t(`ticketStatus.${status.key}`) : pickLocalized(status.name, status.nameUk, status.nameEn, i18n.language)}
                      </th>
                    ))}
                    <th className="px-4 py-2.5 font-bold">{t('reportColumn.avgResponseMinutes')}</th>
                    <th className="px-4 py-2.5 font-bold">{t('reportColumn.avgResolutionMinutes')}</th>
                    <th className="px-4 py-2.5 font-bold">{t('reportColumn.slaComplianceRate')}</th>
                    <th className="px-4 py-2.5 font-bold">{t('reportColumn.weightedKpi')}</th>
                    <th className="px-4 py-2.5 font-bold">{t('reports.operatorsColumnStatusTime')}</th>
                    <th className="px-4 py-2.5 font-bold">{t('reports.operatorsColumnResponseReturn')}</th>
                    <th className="px-4 py-2.5 font-bold">{t('reports.operatorsColumnFcr')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.assigneeId ?? 'none'} className="border-b border-border-subtle text-[13.5px] last:border-0">
                      <td className="px-4 py-3 font-medium">{row.assigneeName}</td>
                      <td className="px-4 py-3 text-ink-muted">{row.total}</td>
                      {(statuses ?? []).map((status) => (
                        <td key={status.id} className="px-4 py-3 text-ink-muted">
                          {row.statusCounts[status.id] ?? 0}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-ink-muted">{formatMinutes(t, row.avgResponseMinutes)}</td>
                      <td className="px-4 py-3 text-ink-muted">{formatMinutes(t, row.avgResolutionMinutes)}</td>
                      <td className="px-4 py-3 text-ink-muted">
                        {row.slaComplianceRate === null ? '—' : `${row.slaComplianceRate}%`}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{row.weightedKpi}</td>
                      <td className="px-4 py-3 text-ink-muted">
                        {row.statusTime.length === 0 ? (
                          '—'
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {row.statusTime.map((entry) => (
                              <div key={entry.statusName}>
                                {entry.statusName}: {formatMinutes(t, entry.minutes)}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{formatMinutes(t, row.responseReturnMinutes)}</td>
                      <td className="px-4 py-3 text-ink-muted">
                        {row.fcrRate === null ? '—' : `${row.fcrRate}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
