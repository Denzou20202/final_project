import type { ReportGroupBy, ReportPeriodBucket } from '@veloxdesk/types';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDownloadRunReportCsv, useRunReport } from '../../hooks/useReports.js';
import { getErrorMessage } from '../../lib/errors.js';
import { DEFAULT_REPORT_FILTERS, formValueToFilters, ReportFiltersForm, ReportFiltersValue } from './ReportFiltersForm.js';
import { SimpleBarChart } from './SimpleBarChart.js';

const BUCKET_OPTIONS: ReportPeriodBucket[] = ['day' as ReportPeriodBucket, 'week' as ReportPeriodBucket, 'month' as ReportPeriodBucket];
const GROUP_BY_PERIOD = 'period' as ReportGroupBy;

// Same underlying report engine as ReportsPage, fixed to groupBy=period —
// a distinct hub section (not just another dropdown option there) because
// the result shape wants a chart, not a sortable/hideable-columns table.
export function DynamicsReportView() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<ReportFiltersValue>(DEFAULT_REPORT_FILTERS);
  const [bucket, setBucket] = useState<ReportPeriodBucket>('day' as ReportPeriodBucket);
  const runReport = useRunReport();
  const downloadCsv = useDownloadRunReportCsv();

  function patch(changes: Partial<ReportFiltersValue>) {
    setFilters((prev) => ({ ...prev, ...changes }));
  }

  function requestArgs() {
    return { groupBy: GROUP_BY_PERIOD, filters: { ...formValueToFilters(filters), periodBucket: bucket } };
  }

  function handleShow() {
    runReport.mutate(requestArgs());
  }

  const report = runReport.data;
  const rows = report?.rows ?? [];
  const chartData = rows.map((row) => ({ key: row.entityId ?? row.entityName, label: row.entityName, value: row.total }));
  const runError = runReport.error
    ? getErrorMessage(runReport.error)
    : downloadCsv.error
      ? getErrorMessage(downloadCsv.error)
      : undefined;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-1 font-display text-lg font-bold">{t('reports.dynamicsTitle')}</div>
      <div className="mb-4 text-[12.5px] text-ink-subtle">{t('reports.dynamicsSubtitle')}</div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-card p-4">
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            {t('reports.periodBucketLabel')}
          </div>
          <div className="flex gap-1.5">
            {BUCKET_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setBucket(value)}
                className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  bucket === value
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-border text-ink-muted hover:bg-surface-muted'
                }`}
              >
                {t(`reportPeriodBucket.${value}`)}
              </button>
            ))}
          </div>
        </div>

        <ReportFiltersForm value={filters} onChange={patch} />

        <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3.5">
          <button
            type="button"
            onClick={handleShow}
            disabled={runReport.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {runReport.isPending ? t('reports.calculating') : t('reports.show')}
          </button>
          {report && (
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

      {report && (
        <div className="mt-4 flex flex-col gap-3">
          <SimpleBarChart data={chartData} />

          {rows.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface-card py-10 text-center text-[13px] text-ink-faint">
              {t('reports.noDataForFilters')}
            </div>
          ) : (
            <div className="overflow-hidden overflow-x-auto rounded-2xl border border-border bg-surface-card">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                    <th className="px-4 py-2.5 font-bold">{t('reportGroupBy.period')}</th>
                    <th className="px-4 py-2.5 font-bold">{t('reportColumn.total')}</th>
                    <th className="px-4 py-2.5 font-bold">{t('reportColumn.slaComplianceRate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.entityId ?? 'none'} className="border-b border-border-subtle text-[13.5px] last:border-0">
                      <td className="px-4 py-3 font-medium">{row.entityName}</td>
                      <td className="px-4 py-3 text-ink-muted">{row.total}</td>
                      <td className="px-4 py-3 text-ink-muted">
                        {row.slaComplianceRate === null ? '—' : `${row.slaComplianceRate}%`}
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
