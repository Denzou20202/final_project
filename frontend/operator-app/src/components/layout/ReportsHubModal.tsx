import type { ComponentType } from 'react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ClipboardIcon,
  CloseIcon,
  DownloadIcon,
  GearIcon,
  HeadsetIcon,
  ReportIcon,
  SmileIcon,
  TrendIcon,
} from '../common/icons.js';
import { PageLoading } from '../common/PageLoading.js';

// Lazy — same reasoning as SettingsModal: only one section is ever mounted
// at a time, so eagerly importing all seven meant every operator downloaded
// the full report-builder/dynamics-chart/export surface on first load even
// if «Отчёты» (admin-only) was never opened.
const AuditReportView = lazy(() => import('../reports/AuditReportView.js').then((m) => ({ default: m.AuditReportView })));
const CsatReportView = lazy(() => import('../reports/CsatReportView.js').then((m) => ({ default: m.CsatReportView })));
const DynamicsReportView = lazy(() =>
  import('../reports/DynamicsReportView.js').then((m) => ({ default: m.DynamicsReportView })),
);
const OperatorReportView = lazy(() =>
  import('../reports/OperatorReportView.js').then((m) => ({ default: m.OperatorReportView })),
);
const SettingsAuditReportView = lazy(() =>
  import('../reports/SettingsAuditReportView.js').then((m) => ({ default: m.SettingsAuditReportView })),
);
const TicketExportView = lazy(() =>
  import('../reports/TicketExportView.js').then((m) => ({ default: m.TicketExportView })),
);
const ReportsPage = lazy(() => import('../../pages/ReportsPage.js'));

type ReportsSection = 'constructor' | 'dynamics' | 'audit' | 'csat' | 'operators' | 'settingsAudit' | 'export';

const SECTIONS: { key: ReportsSection; labelKey: string; Icon: ComponentType<{ className?: string }> }[] = [
  { key: 'constructor', labelKey: 'reportsHub.constructor', Icon: ReportIcon },
  { key: 'dynamics', labelKey: 'reportsHub.dynamics', Icon: TrendIcon },
  { key: 'audit', labelKey: 'reportsHub.audit', Icon: ClipboardIcon },
  { key: 'csat', labelKey: 'reportsHub.csat', Icon: SmileIcon },
  { key: 'operators', labelKey: 'reportsHub.operators', Icon: HeadsetIcon },
  { key: 'settingsAudit', labelKey: 'reportsHub.settingsAudit', Icon: GearIcon },
  { key: 'export', labelKey: 'reportsHub.export', Icon: DownloadIcon },
];

// Admin-only «Отчёты» — was a standalone /reports route (just the
// constructor), now a modal hub in the same spirit as SettingsModal: one
// nav path instead of a route, own left nav, content pane on the right.
// «Конструктор отчётов» already covers grouping by employee/SLA-policy/tag
// (just different groupBy dropdown values there) — those don't need their
// own hub sections, only the genuinely different views (trend chart, an
// aggregate over ticket_activities instead of tickets, a raw ticket-list
// export) do.
export function ReportsHubModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [active, setActive] = useState<ReportsSection>('constructor');

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-surface-card shadow-lg sm:h-[85vh] sm:w-[85vw] sm:flex-row sm:rounded-2xl sm:border sm:border-border">
        <aside className="flex flex-none gap-1 overflow-x-auto border-b border-border bg-surface-sidebar p-2 sm:w-56 sm:flex-col sm:gap-0.5 sm:overflow-visible sm:border-b-0 sm:border-r sm:p-0 sm:py-4">
          <div className="mb-2 hidden px-4 text-[11px] font-bold uppercase tracking-wider text-ink-faint sm:block">
            {t('iconRail.reports')}
          </div>
          <nav className="flex flex-none flex-row gap-1 px-1 sm:flex-col sm:gap-0.5 sm:px-2.5">
            {SECTIONS.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => setActive(section.key)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors ${
                  active === section.key
                    ? 'bg-brand-50 font-semibold text-brand-700'
                    : 'text-ink-muted hover:bg-surface-card'
                }`}
              >
                <section.Icon className="h-4 w-4 flex-none" />
                <span className="min-w-0 truncate">{t(section.labelKey)}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex flex-none items-center justify-end border-b border-border px-3 py-2">
            <button
              type="button"
              onClick={onClose}
              title={t('common.close')}
              aria-label={t('common.close')}
              className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-muted hover:text-priority-urgent"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <Suspense fallback={<PageLoading />}>
              {active === 'constructor' && <ReportsPage />}
              {active === 'dynamics' && <DynamicsReportView />}
              {active === 'audit' && <AuditReportView />}
              {active === 'csat' && <CsatReportView />}
              {active === 'operators' && <OperatorReportView />}
              {active === 'settingsAudit' && <SettingsAuditReportView />}
              {active === 'export' && <TicketExportView />}
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
