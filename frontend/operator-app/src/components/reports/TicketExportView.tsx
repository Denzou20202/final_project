import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDownloadTicketsCsv } from '../../hooks/useReports.js';
import { getErrorMessage } from '../../lib/errors.js';
import { DEFAULT_REPORT_FILTERS, formValueToFilters, ReportFiltersForm, ReportFiltersValue } from './ReportFiltersForm.js';

// A raw, ungrouped ticket list export — same filters as the constructor,
// but one row per ticket instead of aggregated groups.
export function TicketExportView() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<ReportFiltersValue>(DEFAULT_REPORT_FILTERS);
  const download = useDownloadTicketsCsv();

  function patch(changes: Partial<ReportFiltersValue>) {
    setFilters((prev) => ({ ...prev, ...changes }));
  }

  const downloadError = download.error ? getErrorMessage(download.error) : undefined;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-1 font-display text-lg font-bold">{t('reports.exportTitle')}</div>
      <div className="mb-4 text-[12.5px] text-ink-subtle">{t('reports.exportSubtitle')}</div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-card p-4">
        <ReportFiltersForm value={filters} onChange={patch} />

        <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3.5">
          <button
            type="button"
            onClick={() => download.mutate(formValueToFilters(filters))}
            disabled={download.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {download.isPending ? t('analytics.preparing') : t('reports.exportButton')}
          </button>
        </div>
        {downloadError && <p className="text-xs text-priority-urgent">{downloadError}</p>}
      </div>
    </div>
  );
}
