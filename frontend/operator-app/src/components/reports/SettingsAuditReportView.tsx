import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsAuditLog, useDownloadSettingsAuditLogCsv } from '../../hooks/useReports.js';
import { useAssignableUsers } from '../../hooks/useUsers.js';
import { getErrorMessage } from '../../lib/errors.js';
import { endOfLocalDay, formatDateTime, startOfLocalDay, toLocalDateInputValue } from '../../lib/format.js';

const DEFAULT_PERIOD_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const MODULES = ['sla_policy', 'permission_group', 'custom_field', 'automation_rule'] as const;
const EVENT_TYPES = ['created', 'updated', 'deleted'] as const;

// `changes` is `{ ...dto }` verbatim from whichever service wrote the audit
// entry (see e.g. automation-rules.service.ts/custom-fields.service.ts) —
// several DTOs carry array/object fields (automation rule conditions/
// actions, a custom field's optionsByParent), which plain String(value)
// stringified to unreadable "[object Object]"/"[object Object],[object
// Object]". JSON.stringify at least shows the real content; primitives are
// left as String() would already format them (no surrounding quotes on a
// plain string value).
function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// «Глобальный аудит настроек» — settings_audit_log, distinct from
// ticket_activities (AuditReportView above). A raw listing, not an
// aggregate — the point of this report is seeing WHICH change happened, by
// whom, so it doesn't reuse ReportFiltersForm (that's ticket-filter-shaped),
// just its own actor/module/event-type/date filters.
export function SettingsAuditReportView() {
  const { t, i18n } = useTranslation();
  const now = new Date();
  const [from, setFrom] = useState(toLocalDateInputValue(new Date(now.getTime() - DEFAULT_PERIOD_DAYS * MS_PER_DAY)));
  const [to, setTo] = useState(toLocalDateInputValue(now));
  const [actorId, setActorId] = useState('');
  const [module, setModule] = useState('');
  const [eventType, setEventType] = useState('');
  const { data: usersPage } = useAssignableUsers();
  const staff = (usersPage?.items ?? []).filter((u) => u.role !== 'client' && !u.deactivatedAt);
  const log = useSettingsAuditLog();
  const downloadCsv = useDownloadSettingsAuditLogCsv();

  function requestArgs() {
    return {
      from: startOfLocalDay(from).toISOString(),
      to: endOfLocalDay(to).toISOString(),
      actorId: actorId || undefined,
      module: module || undefined,
      eventType: eventType || undefined,
    };
  }

  function handleShow() {
    log.mutate(requestArgs());
  }

  const rows = log.data ?? [];
  const runError = log.error
    ? getErrorMessage(log.error)
    : downloadCsv.error
      ? getErrorMessage(downloadCsv.error)
      : undefined;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-1 font-display text-lg font-bold">{t('reports.settingsAuditTitle')}</div>
      <div className="mb-4 text-[12.5px] text-ink-subtle">{t('reports.settingsAuditSubtitle')}</div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-card p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
              {t('reports.auditColumnActor')}
            </label>
            <select
              value={actorId}
              onChange={(e) => setActorId(e.target.value)}
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
              {t('reports.settingsAuditModuleLabel')}
            </label>
            <select
              value={module}
              onChange={(e) => setModule(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-600"
            >
              <option value="">{t('reports.all')}</option>
              {MODULES.map((value) => (
                <option key={value} value={value}>
                  {t(`settingsAuditModule.${value}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-faint">
              {t('reports.settingsAuditEventLabel')}
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-600"
            >
              <option value="">{t('reports.all')}</option>
              {EVENT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(`settingsAuditEventType.${value}`)}
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
            disabled={log.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {log.isPending ? t('reports.calculating') : t('reports.show')}
          </button>
          {log.data && (
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

      {log.data && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface-card">
          {rows.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-ink-faint">{t('reports.noDataForFilters')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-subtle text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                    <th className="px-4 py-2.5 font-bold">{t('reports.settingsAuditColumnDate')}</th>
                    <th className="px-4 py-2.5 font-bold">{t('reports.auditColumnActor')}</th>
                    <th className="px-4 py-2.5 font-bold">{t('reports.settingsAuditModuleLabel')}</th>
                    <th className="px-4 py-2.5 font-bold">{t('reports.settingsAuditEventLabel')}</th>
                    <th className="px-4 py-2.5 font-bold">{t('reports.settingsAuditColumnEntity')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-border-subtle text-[13.5px] last:border-0">
                      <td className="px-4 py-3 text-ink-faint">{formatDateTime(row.createdAt, i18n.language)}</td>
                      <td className="px-4 py-3 font-medium">{row.actorName}</td>
                      <td className="px-4 py-3 text-ink-muted">{t(`settingsAuditModule.${row.module}`)}</td>
                      <td className="px-4 py-3 text-ink-muted">{t(`settingsAuditEventType.${row.eventType}`)}</td>
                      <td className="px-4 py-3 text-ink-muted">
                        <div>{row.entityLabel}</div>
                        {row.changes && (
                          <div className="mt-0.5 max-w-md truncate text-[11.5px] text-ink-faint">
                            {Object.entries(row.changes)
                              .map(([key, value]) => `${key}: ${formatChangeValue(value)}`)
                              .join(', ')}
                          </div>
                        )}
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
