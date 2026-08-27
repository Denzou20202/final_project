import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCurrentUser } from '../../hooks/useAuth.js';
import { usePendingRegistrations } from '../../hooks/usePendingRegistrations.js';
import { BellIcon, BookIcon, DashboardIcon, GearIcon, ReportIcon, TagIcon } from '../common/icons.js';

// A slim category rail to the left of the main Sidebar — «База знаний» и
// «Дашборд» used to be nav items inside Sidebar itself; they moved here
// (alongside the new «Отчёты») because they're whole separate sections of
// the app, closer in spirit to a VS Code-style activity bar than another
// folder in the tickets tree.
const CATEGORIES: {
  path: string;
  labelKey: string;
  Icon: ComponentType<{ className?: string }>;
}[] = [
  { path: '/knowledge', labelKey: 'iconRail.knowledgeBase', Icon: BookIcon },
  { path: '/analytics', labelKey: 'iconRail.dashboard', Icon: DashboardIcon },
];

function RailButton({
  Icon,
  label,
  active,
  onClick,
  badge,
}: {
  Icon: ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex w-16 flex-none flex-col items-center gap-1 rounded-xl px-1 py-2 transition-colors ${
        active ? 'bg-brand-50 text-brand-700' : 'text-ink-faint hover:bg-surface-card hover:text-brand-600'
      }`}
    >
      <span className="relative">
        <Icon className="h-7 w-7" />
        {!!badge && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-priority-urgent px-1 text-[9.5px] font-bold leading-none text-white">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      <span className="text-center text-[10.5px] font-medium leading-tight">{label}</span>
    </button>
  );
}

export function IconRail({
  isSettingsOpen,
  onOpenSettings,
  isReportsOpen,
  onOpenReports,
  isPendingRegistrationsOpen,
  onOpenPendingRegistrations,
  isTagsOpen,
  onOpenTags,
}: {
  isSettingsOpen: boolean;
  onOpenSettings: () => void;
  isReportsOpen: boolean;
  onOpenReports: () => void;
  isPendingRegistrationsOpen: boolean;
  onOpenPendingRegistrations: () => void;
  isTagsOpen: boolean;
  onOpenTags: () => void;
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'admin';
  const { data: pendingRegistrations } = usePendingRegistrations(isAdmin);

  return (
    <aside className="flex h-full w-20 flex-none flex-col items-center border-r border-border bg-surface-sidebar/85 backdrop-blur-xl py-4">
      <div className="flex flex-1 flex-col items-center gap-2">
        {CATEGORIES.map(({ path, labelKey, Icon }) => (
          <RailButton
            key={path}
            Icon={Icon}
            label={t(labelKey)}
            active={location.pathname.startsWith(path)}
            onClick={() => navigate(path)}
          />
        ))}
        <RailButton Icon={TagIcon} label={t('iconRail.tags')} active={isTagsOpen} onClick={onOpenTags} />
        {isAdmin && (
          <RailButton
            Icon={ReportIcon}
            label={t('iconRail.reports')}
            active={isReportsOpen}
            onClick={onOpenReports}
          />
        )}
        {isAdmin && (
          <RailButton
            Icon={BellIcon}
            label={t('iconRail.pendingRegistrations')}
            active={isPendingRegistrationsOpen}
            onClick={onOpenPendingRegistrations}
            badge={pendingRegistrations?.length}
          />
        )}
      </div>

      {/* mb-[20.6px] (not the plain mb-3 scale) is a hand-tuned match: this
          divider must land at the same height as Sidebar.tsx's own footer
          border-t. That footer is a two-row block (name row + icon row) so
          its height doesn't reduce to a clean spacing scale either — see
          that file's footer comment for why it's shaped this way. */}
      <div className="mb-[20.6px] h-px w-8 flex-none bg-border" />

      <RailButton Icon={GearIcon} label={t('iconRail.settings')} active={isSettingsOpen} onClick={onOpenSettings} />
    </aside>
  );
}
