import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { pickLocalized } from '../../lib/localized.js';
import { useSidebarDepartmentsStore } from '../../store/sidebar-departments.store.js';
import type { PublicTeam } from '../../lib/types.js';
import { Checkbox } from '../common/Checkbox.js';

// «Настроить какие отделы показывать» — same hand-rolled portal-popover
// pattern as ColumnSettingsPopover (TicketsPage), needed for the same
// reason: nested inside the sidebar's own `overflow-y-auto` scroller, which
// would otherwise clip anything absolutely positioned past its edge.
export function DepartmentFilterPopover({
  teams,
  anchorRef,
  onClose,
}: {
  teams: PublicTeam[];
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const hiddenTeamIds = useSidebarDepartmentsStore((s) => s.hiddenTeamIds);
  const toggleHidden = useSidebarDepartmentsStore((s) => s.toggleHidden);
  const reset = useSidebarDepartmentsStore((s) => s.reset);
  const ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    function reposition() {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      // Left-aligned to the anchor by default, but that runs the popover
      // (w-60 = 240px) off the right edge of the viewport when the anchor
      // sits near it — clamp so the whole box stays on screen.
      const POPOVER_WIDTH = 240;
      const MARGIN = 8;
      const left = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - MARGIN));
      setCoords({ top: rect.bottom + 4, left });
    }
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, anchorRef]);

  if (!coords) return null;

  return createPortal(
    <div
      ref={ref}
      style={{ top: coords.top, left: coords.left }}
      className="fixed z-40 w-60 rounded-xl border border-border bg-surface-card p-2 shadow-lg"
    >
      <div className="px-2 pb-1.5 pt-1 text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
        {t('departmentFilter.title')}
      </div>
      {teams.map((team) => (
        <div key={team.id} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface-muted">
          <Checkbox
            id={`dept-filter-${team.id}`}
            checked={!hiddenTeamIds.includes(team.id)}
            onChange={() => toggleHidden(team.id)}
          />
          <label htmlFor={`dept-filter-${team.id}`} className="min-w-0 flex-1 truncate text-[13px]">
            {pickLocalized(team.name, team.nameUk, team.nameEn, i18n.language)}
          </label>
        </div>
      ))}
      {teams.length === 0 && <div className="px-2 py-2 text-[12px] text-ink-faint">{t('departmentFilter.none')}</div>}
      {hiddenTeamIds.length > 0 && (
        <div className="mt-1 border-t border-border-subtle px-2 pt-1.5">
          <button type="button" onClick={reset} className="text-[12px] font-medium text-brand-600 hover:underline">
            {t('departmentFilter.showAll')}
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
