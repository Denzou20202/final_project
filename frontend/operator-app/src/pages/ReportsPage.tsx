import type { ReportGroupBy } from '@veloxdesk/types';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_REPORT_FILTERS,
  filtersToFormValue,
  formValueToFilters,
  ReportFiltersForm,
  ReportFiltersValue,
} from '../components/reports/ReportFiltersForm.js';
import {
  useCreateSavedReport,
  useDeleteSavedReport,
  useDownloadRunReportCsv,
  useDownloadRunReportXml,
  useDownloadTagDetailCsv,
  useRunReport,
  useSavedReports,
  useUpdateSavedReport,
} from '../hooks/useReports.js';
import { useTicketStatuses } from '../hooks/useTicketStatuses.js';
import { getErrorMessage } from '../lib/errors.js';
import { formatMinutes } from '../lib/format.js';
import { pickLocalized } from '../lib/localized.js';
import type { GroupedReportRow, SavedReport } from '../lib/types.js';

// The general-purpose constructor — every dimension the report engine
// supports. «Отчёт по сотрудникам»/«по SLA»/«по меткам» from the reports
// hub's original design turned out to just be this same tool with a
// different groupBy pre-selected (assignee/sla_policy/tag), so they don't
// get separate hub sections — this one dropdown already reaches them.
const GROUP_BY_OPTIONS: ReportGroupBy[] = [
  'assignee' as ReportGroupBy,
  'client' as ReportGroupBy,
  'company' as ReportGroupBy,
  'team' as ReportGroupBy,
  'category' as ReportGroupBy,
  'status' as ReportGroupBy,
  'priority' as ReportGroupBy,
  'type' as ReportGroupBy,
  'tag' as ReportGroupBy,
  'sla_policy' as ReportGroupBy,
  'channel' as ReportGroupBy,
];

type ColumnKey = string;

interface ColumnDef {
  key: ColumnKey;
  header: string;
  render: (row: GroupedReportRow) => ReactNode;
}

// Prefix matches reports.service.ts's statusColumnKey() exactly — the same
// string is sent back as `columns` on export/save, so the backend can map
// it back to the right status.
function statusColumnKey(statusId: string): string {
  return `status_${statusId}`;
}

interface BuilderState extends ReportFiltersValue {
  groupBy: ReportGroupBy;
}

const DEFAULT_BUILDER: BuilderState = {
  groupBy: 'assignee' as ReportGroupBy,
  ...DEFAULT_REPORT_FILTERS,
};

export default function ReportsPage() {
  const { t, i18n } = useTranslation();
  const { data: savedReports } = useSavedReports();
  const { data: statuses } = useTicketStatuses();
  const runReport = useRunReport();
  const downloadCsv = useDownloadRunReportCsv();
  const downloadXml = useDownloadRunReportXml();
  const downloadTagDetail = useDownloadTagDetailCsv();
  const createSaved = useCreateSavedReport();
  const updateSaved = useUpdateSavedReport();
  const deleteSaved = useDeleteSavedReport();

  const [builder, setBuilder] = useState<BuilderState>(DEFAULT_BUILDER);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [reportName, setReportName] = useState('');
  const [hiddenColumns, setHiddenColumns] = useState<Set<ColumnKey>>(new Set());
  const [saveError, setSaveError] = useState<string | undefined>(undefined);

  // One column per live status — replaces the old fixed
  // open/pending/resolved/closed set, which couldn't express a custom
  // admin-added status. Order: total, then every status in its admin-set
  // sortOrder, then the fixed metric columns (mirrors reports.service.ts's
  // buildColumnDefs exactly).
  const columnDefs = useMemo((): ColumnDef[] => {
    const defs: ColumnDef[] = [{ key: 'total', header: t('reportColumn.total'), render: (r) => r.total }];
    for (const status of statuses ?? []) {
      defs.push({
        key: statusColumnKey(status.id),
        header: status.key ? t(`ticketStatus.${status.key}`) : pickLocalized(status.name, status.nameUk, status.nameEn, i18n.language),
        render: (r) => r.statusCounts[status.id] ?? 0,
      });
    }
    defs.push(
      {
        key: 'avgResponseMinutes',
        header: t('reportColumn.avgResponseMinutes'),
        render: (r) => formatMinutes(t, r.avgResponseMinutes),
      },
      {
        key: 'avgResolutionMinutes',
        header: t('reportColumn.avgResolutionMinutes'),
        render: (r) => formatMinutes(t, r.avgResolutionMinutes),
      },
      {
        key: 'slaComplianceRate',
        header: t('reportColumn.slaComplianceRate'),
        render: (r) => (r.slaComplianceRate === null ? '—' : `${r.slaComplianceRate}%`),
      },
      { key: 'weightedKpi', header: t('reportColumn.weightedKpi'), render: (r) => r.weightedKpi },
    );
    return defs;
  }, [statuses, t, i18n.language]);
  const COLUMN_KEYS = useMemo(() => columnDefs.map((d) => d.key), [columnDefs]);

  function patch(changes: Partial<BuilderState>) {
    setBuilder((prev) => ({ ...prev, ...changes }));
  }

  function runWith(state: BuilderState) {
    runReport.mutate({ groupBy: state.groupBy, filters: formValueToFilters(state) });
  }

  function handleShow() {
    runWith(builder);
  }

  function handleNewReport() {
    setBuilder(DEFAULT_BUILDER);
    setSelectedSavedId(null);
    setReportName('');
    runReport.reset();
  }

  function handleOpenSaved(report: SavedReport) {
    const nextBuilder: BuilderState = { groupBy: report.groupBy, ...filtersToFormValue(report.filters) };
    setBuilder(nextBuilder);
    setSelectedSavedId(report.id);
    setReportName(report.name);
    setHiddenColumns(
      report.columns ? new Set(COLUMN_KEYS.filter((k) => !report.columns?.includes(k))) : new Set(),
    );
    runWith(nextBuilder);
  }

  async function handleDeleteSaved(id: string) {
    if (!window.confirm(t('reports.deleteSavedConfirm'))) return;
    await deleteSaved.mutateAsync(id);
    if (selectedSavedId === id) handleNewReport();
  }

  const visibleColumnKeys = COLUMN_KEYS.filter((key) => !hiddenColumns.has(key));

  async function handleSaveNew() {
    const name = reportName.trim();
    if (!name) {
      setSaveError(t('reports.reportNameRequired'));
      return;
    }
    setSaveError(undefined);
    try {
      const created = await createSaved.mutateAsync({
        name,
        groupBy: builder.groupBy,
        filters: formValueToFilters(builder),
        columns: visibleColumnKeys,
      });
      setSelectedSavedId(created.id);
    } catch (error) {
      setSaveError(getErrorMessage(error));
    }
  }

  async function handleUpdateSaved() {
    if (!selectedSavedId) return;
    const name = reportName.trim();
    if (!name) {
      setSaveError(t('reports.reportNameRequired'));
      return;
    }
    setSaveError(undefined);
    try {
      await updateSaved.mutateAsync({
        id: selectedSavedId,
        name,
        groupBy: builder.groupBy,
        filters: formValueToFilters(builder),
        columns: visibleColumnKeys,
      });
    } catch (error) {
      setSaveError(getErrorMessage(error));
    }
  }

  const selectedSaved = useMemo(
    () => savedReports?.find((r) => r.id === selectedSavedId) ?? null,
    [savedReports, selectedSavedId],
  );

  const report = runReport.data;
  const rows: GroupedReportRow[] = report?.rows ?? [];
  const runError = runReport.error
    ? getErrorMessage(runReport.error)
    : downloadCsv.error
      ? getErrorMessage(downloadCsv.error)
      : downloadXml.error
        ? getErrorMessage(downloadXml.error)
        : downloadTagDetail.error
          ? getErrorMessage(downloadTagDetail.error)
          : undefined;

  return (
    <div className="flex h-full">
      {/* Saved-report list — hidden below sm: a fixed 256px column would eat
          almost the whole phone screen before the builder itself even
          starts. "New report" still works on mobile; picking up a
          previously saved one is a desktop-only affordance for now. */}
      <aside className="hidden w-64 flex-none flex-col overflow-y-auto border-r border-border bg-surface-sidebar p-4 sm:flex">
        <button
          type="button"
          onClick={handleNewReport}
          className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 py-2 text-[13.5px] font-semibold text-white hover:bg-brand-hover"
        >
          <span className="-mt-px text-base leading-none">+</span> {t('reports.newReport')}
        </button>
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
          {t('reports.savedReports')}
        </div>
        <div className="flex flex-col gap-1">
          {(savedReports ?? []).map((r) => (
            <div
              key={r.id}
              className={`group flex items-center gap-1 rounded-lg px-2.5 py-2 text-left text-[13px] ${
                selectedSavedId === r.id ? 'bg-brand-50 font-semibold text-brand-700' : 'hover:bg-surface-card'
              }`}
            >
              <button type="button" onClick={() => handleOpenSaved(r)} className="min-w-0 flex-1 truncate text-left">
                {r.name}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSaved(r.id)}
                aria-label={t('reports.deleteSavedAria', { name: r.name })}
                className="invisible flex-none text-ink-faint hover:text-priority-urgent group-hover:visible"
              >
                ×
              </button>
            </div>
          ))}
          {savedReports?.length === 0 && (
            <div className="px-2.5 py-2 text-[12.5px] text-ink-faint">{t('reports.noSavedReports')}</div>
          )}
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-1 font-display text-lg font-bold">{t('reports.builderTitle')}</div>
        <div className="mb-4 text-[12.5px] text-ink-subtle">{t('reports.builderSubtitle')}</div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-card p-4">
          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
              {t('reports.groupByLabel')}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {GROUP_BY_OPTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => patch({ groupBy: value })}
                  className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    builder.groupBy === value
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-border text-ink-muted hover:bg-surface-muted'
                  }`}
                >
                  {t(`reportGroupBy.${value}`)}
                </button>
              ))}
            </div>
          </div>

          <ReportFiltersForm value={builder} onChange={patch} />

          <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3.5">
            <button
              type="button"
              onClick={handleShow}
              disabled={runReport.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
            >
              {runReport.isPending ? t('reports.calculating') : t('reports.show')}
            </button>

            <input
              type="text"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder={t('reports.reportNamePlaceholder')}
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface-card px-3 py-2 text-[13px] outline-none focus:border-brand-600"
            />
            {selectedSaved && (
              <button
                type="button"
                onClick={() => void handleUpdateSaved()}
                disabled={updateSaved.isPending}
                className="rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-60"
              >
                {t('reports.updateSaved', { name: selectedSaved.name })}
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleSaveNew()}
              disabled={createSaved.isPending}
              className="rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-60"
            >
              {t('reports.saveAsNew')}
            </button>
          </div>
          {runError && <p className="text-xs text-priority-urgent">{runError}</p>}
          {saveError && <p className="text-xs text-priority-urgent">{saveError}</p>}
        </div>

        {report && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-4 py-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                {t('reports.grouping')}: {report.groupLabel} · {t('reports.rowsCount', { count: rows.length })}
              </div>
              <div className="flex-1" />
              {columnDefs.map(({ key, header }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setHiddenColumns((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    })
                  }
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                    hiddenColumns.has(key)
                      ? 'border-border text-ink-faint line-through'
                      : 'border-brand-600/40 bg-brand-50 text-brand-700'
                  }`}
                >
                  {header}
                </button>
              ))}
              {report.groupBy === ('tag' as ReportGroupBy) && (
                <button
                  type="button"
                  onClick={() => downloadTagDetail.mutate(formValueToFilters(builder))}
                  disabled={downloadTagDetail.isPending}
                  title={t('reports.exportTagDetailHint')}
                  className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-60"
                >
                  {downloadTagDetail.isPending ? t('analytics.preparing') : t('reports.exportTagDetail')}
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  downloadCsv.mutate({
                    groupBy: report.groupBy,
                    filters: formValueToFilters(builder),
                    columns: visibleColumnKeys,
                  })
                }
                disabled={downloadCsv.isPending}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
              >
                {downloadCsv.isPending ? t('analytics.preparing') : t('analytics.exportCsv')}
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadXml.mutate({
                    groupBy: report.groupBy,
                    filters: formValueToFilters(builder),
                    columns: visibleColumnKeys,
                  })
                }
                disabled={downloadXml.isPending}
                className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-60"
              >
                {downloadXml.isPending ? t('analytics.preparing') : t('reports.exportXml')}
              </button>
            </div>

            {rows.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-ink-faint">{t('reports.noDataForFilters')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                      <th className="px-4 py-2.5 font-bold">{report.groupLabel}</th>
                      {columnDefs
                        .filter(({ key }) => !hiddenColumns.has(key))
                        .map(({ key, header }) => (
                          <th key={key} className="px-4 py-2.5 font-bold">
                            {header}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.entityId ?? 'none'} className="border-b border-border-subtle text-[13.5px] last:border-0">
                        <td className="px-4 py-3 font-medium">{row.entityName}</td>
                        {columnDefs
                          .filter(({ key }) => !hiddenColumns.has(key))
                          .map(({ key, render }) => (
                            <td key={key} className="px-4 py-3 text-ink-muted">
                              {render(row)}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
