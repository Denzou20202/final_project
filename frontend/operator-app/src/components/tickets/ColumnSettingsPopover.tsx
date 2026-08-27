import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useTicketTableStore, type TicketColumnKey } from '../../store/ticket-table.store.js';
import { Checkbox } from '../common/Checkbox.js';

// Translation keys, not labels themselves — column names appear in the
// table header (TicketsPage.tsx) and this popover, both of which resolve
// them through t() so they follow the active language.
export const COLUMN_LABEL_KEYS: Record<TicketColumnKey, string> = {
  number: 'tickets.columnNumber',
  title: 'tickets.columnTitle',
  client: 'tickets.columnClient',
  assignee: 'tickets.columnAssignee',
  team: 'tickets.columnTeam',
  sla: 'tickets.columnSla',
  status: 'tickets.columnStatus',
  priority: 'tickets.columnPriority',
  createdAt: 'tickets.columnCreatedAt',
};

// «Выберите столбцы для отображения и их порядок» — the gear next to the
// select-all checkbox opens this. Hiding every column would leave an
// unusable empty table, so the last visible one can't be unchecked.
//
// Rendered through a portal into document.body, positioned `fixed` from the
// anchor button's own rect — the header cell it lives next to sits inside
// the table's `overflow-x-auto` scroll wrapper, which (per the CSS spec)
// computes `overflow-y` to `auto` too the moment `overflow-x` is non-visible,
// clipping anything that would otherwise overflow below it. An
// absolutely-positioned popover nested in that wrapper got hard-clipped
// after its first row; escaping via a portal sidesteps that entirely.
export function ColumnSettingsPopover({
  anchorRef,
  onClose,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const order = useTicketTableStore((s) => s.order);
  const hidden = useTicketTableStore((s) => s.hidden);
  const toggleHidden = useTicketTableStore((s) => s.toggleHidden);
  const move = useTicketTableStore((s) => s.move);
  const reset = useTicketTableStore((s) => s.reset);
  const ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  // Fixed positioning is relative to the viewport, so the popover must
  // re-anchor whenever the page (or the table's own scroll container)
  // moves under it — capture-phase scroll catches inner scrollers too.
  useEffect(() => {
    function reposition() {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      // Left-aligned to the anchor by default, but that runs the popover
      // (w-60 = 240px) off the right edge of the viewport when the anchor
      // itself sits near it — clamp so the whole box stays on screen.
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

  const visibleCount = order.filter((key) => !hidden[key]).length;

  if (!coords) return null;

  return createPortal(
    <div
      ref={ref}
      style={{ top: coords.top, left: coords.left }}
      className="fixed z-40 w-60 rounded-xl border border-border bg-surface-card p-2 shadow-lg"
    >
      <div className="px-2 pb-1.5 pt-1 text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
        {t('tickets.columnsAndOrder')}
      </div>
      {order.map((key, index) => {
        const label = t(COLUMN_LABEL_KEYS[key]);
        return (
          <div key={key} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface-muted">
            <Checkbox
              id={`col-${key}`}
              checked={!hidden[key]}
              disabled={!hidden[key] && visibleCount === 1}
              onChange={() => toggleHidden(key)}
            />
            <label htmlFor={`col-${key}`} className="min-w-0 flex-1 truncate text-[13px]">
              {label}
            </label>
            <button
              type="button"
              onClick={() => move(key, -1)}
              disabled={index === 0}
              aria-label={t('tickets.moveUp', { label })}
              className="rounded px-1 text-[11px] text-ink-faint hover:bg-surface-card hover:text-brand-600 disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(key, 1)}
              disabled={index === order.length - 1}
              aria-label={t('tickets.moveDown', { label })}
              className="rounded px-1 text-[11px] text-ink-faint hover:bg-surface-card hover:text-brand-600 disabled:opacity-30"
            >
              ↓
            </button>
          </div>
        );
      })}
      <div className="mt-1 border-t border-border-subtle px-2 pt-1.5">
        <button type="button" onClick={reset} className="text-[12px] font-medium text-brand-600 hover:underline">
          {t('tickets.resetTable')}
        </button>
      </div>
    </div>,
    document.body,
  );
}
