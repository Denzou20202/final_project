import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentUser } from '../../hooks/useAuth.js';
import { CloseIcon } from '../common/icons.js';
import { PageLoading } from '../common/PageLoading.js';

// Lazy — only one section is ever mounted at a time (see the `active ===`
// switch below), so eagerly importing all nine meant every operator paid
// for the whole admin surface (permission groups, custom fields, automation
// rules, …) on first load even if they never open Settings at all.
const AuthenticationSettingsPage = lazy(() => import('../../pages/AuthenticationSettingsPage.js'));
const AutomationRulesPage = lazy(() => import('../../pages/AutomationRulesPage.js'));
const CategoriesSettingsPage = lazy(() => import('../../pages/CategoriesSettingsPage.js'));
const CitiesSettingsPage = lazy(() => import('../../pages/CitiesSettingsPage.js'));
const CompaniesSettingsPage = lazy(() => import('../../pages/CompaniesSettingsPage.js'));
const CsatQuestionsSettingsPage = lazy(() => import('../../pages/CsatQuestionsSettingsPage.js'));
const CustomFieldsPage = lazy(() => import('../../pages/CustomFieldsPage.js'));
const EmployeeStatusesSettingsPage = lazy(() => import('../../pages/EmployeeStatusesSettingsPage.js'));
const KnowledgeThemeSettingsPage = lazy(() => import('../../pages/KnowledgeThemeSettingsPage.js'));
const MacrosPage = lazy(() => import('../../pages/MacrosPage.js'));
const PermissionGroupsSettingsPage = lazy(() => import('../../pages/PermissionGroupsSettingsPage.js'));
const SlaPoliciesPage = lazy(() => import('../../pages/SlaPoliciesPage.js'));
const TeamsSettingsPage = lazy(() => import('../../pages/TeamsSettingsPage.js'));
const TicketStatusesSettingsPage = lazy(() => import('../../pages/TicketStatusesSettingsPage.js'));
const TicketTypesSettingsPage = lazy(() => import('../../pages/TicketTypesSettingsPage.js'));
const UsersPage = lazy(() => import('../../pages/UsersPage.js'));

type SettingsSection =
  | 'sla'
  | 'macros'
  | 'custom-fields'
  | 'automation'
  | 'teams'
  | 'categories'
  | 'companies'
  | 'cities'
  | 'permission-groups'
  | 'employee-statuses'
  | 'ticket-statuses'
  | 'csat-questions'
  | 'ticket-types'
  | 'knowledge-theme'
  | 'authentication'
  | 'users';

const SECTIONS: { key: SettingsSection; labelKey: string; adminOnly?: boolean }[] = [
  { key: 'sla', labelKey: 'admin.navSla' },
  { key: 'macros', labelKey: 'admin.navMacros' },
  { key: 'custom-fields', labelKey: 'admin.navCustomFields', adminOnly: true },
  { key: 'automation', labelKey: 'admin.navAutomation', adminOnly: true },
  { key: 'teams', labelKey: 'admin.navTeams' },
  { key: 'categories', labelKey: 'admin.navCategories', adminOnly: true },
  { key: 'companies', labelKey: 'admin.navCompanies', adminOnly: true },
  { key: 'cities', labelKey: 'admin.navCities', adminOnly: true },
  { key: 'permission-groups', labelKey: 'admin.navPermissionGroups', adminOnly: true },
  { key: 'employee-statuses', labelKey: 'admin.navEmployeeStatuses', adminOnly: true },
  { key: 'ticket-statuses', labelKey: 'admin.navTicketStatuses', adminOnly: true },
  { key: 'csat-questions', labelKey: 'admin.navCsatQuestions', adminOnly: true },
  { key: 'ticket-types', labelKey: 'admin.navTicketTypes', adminOnly: true },
  { key: 'knowledge-theme', labelKey: 'admin.navKnowledgeTheme', adminOnly: true },
  { key: 'authentication', labelKey: 'admin.navAuthentication', adminOnly: true },
  { key: 'users', labelKey: 'admin.navUsers' },
];

// A desktop-app-style preferences window: its own left nav for the sections
// that used to be separate full-page routes (SLA/Macros/Custom fields/
// Dispatcher/Users), content on the right. Reuses those page components
// directly rather than duplicating their markup — they're already
// self-contained (`h-full flex-col`), so they drop into the content pane
// unchanged. The standalone routes are gone (see app.tsx) — this modal is
// the only way to reach them now, so there's exactly one navigation path
// to keep in sync instead of two.
export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'admin';
  const visibleSections = SECTIONS.filter((section) => !section.adminOnly || isAdmin);
  const [active, setActive] = useState<SettingsSection>('sla');

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 sm:px-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-surface-card shadow-lg sm:h-[88vh] sm:max-w-7xl sm:flex-row sm:rounded-2xl sm:border sm:border-border">
        <aside className="flex flex-none gap-1 overflow-x-auto border-b border-border bg-surface-sidebar p-2 sm:w-56 sm:flex-col sm:gap-0.5 sm:overflow-visible sm:border-b-0 sm:border-r sm:p-0 sm:py-4">
          <div className="mb-2 hidden px-4 text-[11px] font-bold uppercase tracking-wider text-ink-faint sm:block">{t('admin.title')}</div>
          <nav className="flex flex-none flex-row gap-1 px-1 sm:flex-col sm:gap-0.5 sm:px-2.5">
            {visibleSections.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => setActive(section.key)}
                className={`whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors ${
                  active === section.key
                    ? 'bg-brand-50 font-semibold text-brand-700'
                    : 'text-ink-muted hover:bg-surface-card'
                }`}
              >
                {t(section.labelKey)}
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
              {active === 'sla' && <SlaPoliciesPage />}
              {active === 'macros' && <MacrosPage />}
              {active === 'custom-fields' && isAdmin && <CustomFieldsPage />}
              {active === 'automation' && isAdmin && <AutomationRulesPage />}
              {active === 'teams' && <TeamsSettingsPage />}
              {active === 'categories' && isAdmin && <CategoriesSettingsPage />}
              {active === 'companies' && isAdmin && <CompaniesSettingsPage />}
              {active === 'cities' && isAdmin && <CitiesSettingsPage />}
              {active === 'permission-groups' && isAdmin && <PermissionGroupsSettingsPage />}
              {active === 'employee-statuses' && isAdmin && <EmployeeStatusesSettingsPage />}
              {active === 'ticket-statuses' && isAdmin && <TicketStatusesSettingsPage />}
              {active === 'csat-questions' && isAdmin && <CsatQuestionsSettingsPage />}
              {active === 'ticket-types' && isAdmin && <TicketTypesSettingsPage />}
              {active === 'knowledge-theme' && isAdmin && <KnowledgeThemeSettingsPage />}
              {active === 'authentication' && isAdmin && <AuthenticationSettingsPage />}
              {active === 'users' && <UsersPage />}
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
