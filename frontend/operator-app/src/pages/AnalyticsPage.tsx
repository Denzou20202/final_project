import type { TFunction } from 'i18next';
import { useEffect, useMemo, useState } from 'react';
import Tilt from 'react-parallax-tilt';
import { useTranslation } from 'react-i18next';
import { useDashboard, useDownloadReportCsv, useTeamLoad } from '../hooks/useReports.js';
import { useTicketStatuses } from '../hooks/useTicketStatuses.js';
import { getErrorMessage } from '../lib/errors.js';
import { pickLocalized } from '../lib/localized.js';

// Recomputed every 5 minutes (not on every render — that would defeat the
// query-key memoization below and refetch constantly) so an operator who
// leaves this tab open doesn't keep looking at a `to` boundary frozen at
// whatever moment the page happened to mount, silently excluding every
// ticket/reply created since.
const PERIOD_REFRESH_MS = 5 * 60 * 1000;

const PERIOD_PRESETS = [
  { value: 7, labelKey: 'analytics.period7' },
  { value: 30, labelKey: 'analytics.period30' },
  { value: 90, labelKey: 'analytics.period90' },
];

function formatMinutes(t: TFunction, value: number | null): string {
  if (value === null) return '—';
  if (value < 60) return t('analytics.minutesShort', { count: value });
  return t('analytics.hoursShort', { count: (value / 60).toFixed(1) });
}

export default function AnalyticsPage() {
  const { t, i18n } = useTranslation();
  const [periodDays, setPeriodDays] = useState(30);
  const [refreshedAt, setRefreshedAt] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setRefreshedAt(Date.now()), PERIOD_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);
  const period = useMemo(() => {
    const to = new Date(refreshedAt);
    const from = new Date(to.getTime() - periodDays * 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [periodDays, refreshedAt]);

  const { data: dashboard, isLoading: isDashboardLoading, error: dashboardError } = useDashboard(period);
  const { data: teamLoad, isLoading: isTeamLoadLoading, error: teamLoadError } = useTeamLoad(period);
  const { data: statuses } = useTicketStatuses();
  const downloadCsv = useDownloadReportCsv();
  const loadError = dashboardError
    ? getErrorMessage(dashboardError)
    : teamLoadError
      ? getErrorMessage(teamLoadError)
      : undefined;

  function statusLabel(statusId: string): string {
    const status = statuses?.find((s) => s.id === statusId);
    if (!status) return statusId;
    return status.key ? t(`ticketStatusFolder.${status.key}`) : pickLocalized(status.name, status.nameUk, status.nameEn, i18n.language);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-none flex-col gap-2.5 px-4 pb-3.5 pt-4 sm:flex-row sm:items-center sm:gap-3 sm:px-6">
        <div>
          <div className="font-display text-lg font-bold">{t('analytics.title')}</div>
          <div className="mt-0.5 text-[12.5px] text-ink-subtle">{t('analytics.subtitle')}</div>
        </div>
        <div className="hidden flex-1 sm:block" />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value))}
            className="rounded-lg border border-border bg-surface-card px-3 py-1.5 text-[12.5px] text-ink-muted outline-none"
          >
            {PERIOD_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {t(preset.labelKey)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => downloadCsv.mutate(period)}
            disabled={downloadCsv.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {downloadCsv.isPending ? t('analytics.preparing') : t('analytics.exportCsv')}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6 sm:px-6">
        {isDashboardLoading && <div className="py-16 text-center text-sm text-ink-subtle">{t('common.loading')}</div>}

        {loadError && (
          <p className="mb-3 rounded-lg bg-priority-urgent/10 px-3 py-2 text-sm text-priority-urgent">{loadError}</p>
        )}

        {dashboard && (
          <>
            <div className="grid grid-cols-4 gap-3">
              <Tilt tiltMaxAngleX={10} tiltMaxAngleY={10} glareEnable={true} glareMaxOpacity={0.1} scale={1.02} className="h-full">
                <div className="flex h-full flex-col justify-center rounded-2xl border border-border bg-surface-card p-4 shadow-sm transition-shadow hover:shadow-md">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">{t('analytics.totalTickets')}</div>
                  <div className="mt-1.5 font-display text-2xl font-bold">{dashboard.totalTickets}</div>
                </div>
              </Tilt>
              <Tilt tiltMaxAngleX={10} tiltMaxAngleY={10} glareEnable={true} glareMaxOpacity={0.1} scale={1.02} className="h-full">
                <div className="flex h-full flex-col justify-center rounded-2xl border border-border bg-surface-card p-4 shadow-sm transition-shadow hover:shadow-md">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">{t('analytics.avgResponseTime')}</div>
                  <div className="mt-1.5 font-display text-2xl font-bold">{formatMinutes(t, dashboard.avgResponseMinutes)}</div>
                </div>
              </Tilt>
              <Tilt tiltMaxAngleX={10} tiltMaxAngleY={10} glareEnable={true} glareMaxOpacity={0.1} scale={1.02} className="h-full">
                <div className="flex h-full flex-col justify-center rounded-2xl border border-border bg-surface-card p-4 shadow-sm transition-shadow hover:shadow-md">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">{t('analytics.avgResolutionTime')}</div>
                  <div className="mt-1.5 font-display text-2xl font-bold">{formatMinutes(t, dashboard.avgResolutionMinutes)}</div>
                </div>
              </Tilt>
              <Tilt tiltMaxAngleX={10} tiltMaxAngleY={10} glareEnable={true} glareMaxOpacity={0.1} scale={1.02} className="h-full">
                <div className="flex h-full flex-col justify-center rounded-2xl border border-border bg-surface-card p-4 shadow-sm transition-shadow hover:shadow-md">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">{t('analytics.slaCompliance')}</div>
                  <div className="mt-1.5 font-display text-2xl font-bold">
                    {dashboard.slaComplianceRate === null ? '—' : `${dashboard.slaComplianceRate}%`}
                  </div>
                </div>
              </Tilt>
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-surface-card p-4">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{t('analytics.byStatus')}</div>
              <div className="flex flex-wrap gap-4">
                {Object.entries(dashboard.statusBreakdown).map(([statusId, count]) => (
                  <div key={statusId} className="text-[13px]">
                    <span className="text-ink-muted">{statusLabel(statusId)}: </span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
                {Object.keys(dashboard.statusBreakdown).length === 0 && (
                  <div className="text-[13px] text-ink-faint">{t('analytics.noDataForPeriod')}</div>
                )}
              </div>
            </div>
          </>
        )}

        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface-card">
          <div className="border-b border-border-subtle px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
            {t('analytics.teamLoad')}
          </div>
          {isTeamLoadLoading && <div className="py-10 text-center text-sm text-ink-subtle">{t('common.loading')}</div>}
          {teamLoad && teamLoad.teams.length > 0 && (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="px-4 py-2.5 font-bold">{t('analytics.columnTeam')}</th>
                  <th className="px-4 py-2.5 font-bold">{t('analytics.columnTotal')}</th>
                  {(statuses ?? []).map((status) => (
                    <th key={status.id} className="px-4 py-2.5 font-bold">
                      {status.key ? t(`ticketStatusFolder.${status.key}`) : pickLocalized(status.name, status.nameUk, status.nameEn, i18n.language)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamLoad.teams.map((row) => (
                  <tr key={row.teamId ?? 'none'} className="border-b border-border-subtle text-[13.5px] last:border-0">
                    <td className="px-4 py-3 font-medium">{row.teamName}</td>
                    <td className="px-4 py-3 text-ink-muted">{row.total}</td>
                    {(statuses ?? []).map((status) => (
                      <td key={status.id} className="px-4 py-3 text-ink-muted">
                        {row.statusCounts[status.id] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {teamLoad && teamLoad.teams.length === 0 && (
            <div className="py-10 text-center text-[13px] text-ink-faint">{t('analytics.noTicketsForPeriod')}</div>
          )}
        </div>
      </div>
    </div>
  );
}
