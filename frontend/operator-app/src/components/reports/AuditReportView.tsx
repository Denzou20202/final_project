import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RoleBadge } from '../common/RoleBadge.js';
import { useAuditSummary, useDownloadAuditSummaryCsv } from '../../hooks/useReports.js';
import { getErrorMessage } from '../../lib/errors.js';
import { endOfLocalDay, startOfLocalDay, toLocalDateInputValue } from '../../lib/format.js';
import type { UserRole } from '../../lib/types.js';

const DEFAULT_PERIOD_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Aggregates ticket_activities — a different data source than every other
// hub section (which all group `tickets`), so it doesn't reuse
// ReportFiltersForm at all, just a plain date range + groupBy toggle.
export function AuditReportView() {
  const { t } = useTranslation();
  const now = new Date();
  const [from, setFrom] = useState(toLocalDateInputValue(new Date(now.getTime() - DEFAULT_PERIOD_DAYS * MS_PER_DAY)));
  const [to, setTo] = useState(toLocalDateInputValue(now));
  const [groupBy, setGroupBy] = useState<'type' | 'actor'>('type');
  const summary = useAuditSummary();
  const downloadCsv = useDownloadAuditSummaryCsv();

  function requestArgs() {
    return { groupBy, from: startOfLocalDay(from).toISOString(), to: endOfLocalDay(to).toISOString() };
  }

  function handleShow() {
    summary.mutate(requestArgs());
  }

  const rows = summary.data ?? [];
  const runError = summary.error
    ? getErrorMessage(summary.error)
    : downloadCsv.error
      ? getErrorMessage(downloadCsv.error)
      : undefined;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-1 font-display text-lg font-bold">{t('reports.auditTitle')}</div>
      <div className="mb-4 text-[12.5px] text-ink-subtle">{t('reports.auditSubtitle')}</div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-card p-4">
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            {t('reports.groupByLabel')}
          </div>
          <div className="flex gap-1.5">
            {(['type', 'actor'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setGroupBy(value)}
                className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  groupBy === value
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-border text-ink-muted hover:bg-surface-muted'
                }`}
              >
                {t(`reports.auditGroupBy.${value}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          {summary.data && (
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

      {summary.data && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface-card">
          {rows.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-ink-faint">{t('reports.noDataForFilters')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                    <th className="px-4 py-2.5 font-bold">
                      {groupBy === 'actor' ? t('reports.auditColumnActor') : t('reports.auditColumnType')}
                    </th>
                    <th className="px-4 py-2.5 font-bold">{t('reportColumn.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key ?? 'none'} className="border-b border-border-subtle text-[13.5px] last:border-0">
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-1.5">
                          {groupBy === 'actor' ? row.label : t(`auditActivityType.${row.label}`, { defaultValue: row.label })}
                          {row.role && <RoleBadge role={row.role as UserRole} />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{row.count}</td>
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
