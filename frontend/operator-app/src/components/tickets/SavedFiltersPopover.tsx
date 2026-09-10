import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useTicketFilterPresetsStore } from '../../store/ticket-filter-presets.store.js';

// «Сохранённые фильтры» — mirrors ColumnSettingsPopover.tsx's shell exactly
// (portal, fixed-positioned from the anchor button, close on outside
// click/Escape) since it lives right next to it in the same header toolbar.
export function SavedFiltersPopover({
  anchorRef,
  currentSearch,
  onApply,
  onClose,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  currentSearch: string;
  onApply: (search: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const presets = useTicketFilterPresetsStore((s) => s.presets);
  const addPreset = useTicketFilterPresetsStore((s) => s.addPreset);
  const removePreset = useTicketFilterPresetsStore((s) => s.removePreset);
  const [draftName, setDraftName] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    function reposition() {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      // Left-aligned to the anchor by default, but that runs the popover
      // (w-64 = 256px) off the right edge of the viewport when the anchor
      // itself sits near it (e.g. this button, at the right end of the
      // filter toolbar) — clamp so the whole box stays on screen instead.
      const POPOVER_WIDTH = 256;
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

  function handleSave() {
    const name = draftName.trim();
    if (!name) return;
    addPreset(name, currentSearch);
    setDraftName('');
  }

  return createPortal(
    <div
      ref={ref}
      style={{ top: coords.top, left: coords.left }}
      className="fixed z-40 w-64 rounded-xl border border-border bg-surface-card p-2 shadow-lg"
    >
      <div className="px-2 pb-1.5 pt-1 text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
        {t('tickets.savedFilters')}
      </div>
      {presets.length === 0 && (
        <div className="px-2 py-2 text-[12.5px] text-ink-faint">{t('tickets.noSavedFilters')}</div>
      )}
      {presets.map((preset) => (
        <div key={preset.id} className="group flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-surface-muted">
          <button
            type="button"
            onClick={() => {
              onApply(preset.search);
              onClose();
            }}
            className="min-w-0 flex-1 truncate text-left text-[13px]"
          >
            {preset.name}
          </button>
          <button
            type="button"
            onClick={() => removePreset(preset.id)}
            aria-label={t('tickets.removeSavedFilterAria', { name: preset.name })}
            className="invisible flex-none text-ink-faint hover:text-priority-urgent group-hover:visible"
          >
            ×
          </button>
        </div>
      ))}
      {/* Nothing to save when every filter is cleared — «Все тикеты»
          isn't a combination worth naming and bookmarking. */}
      {currentSearch && (
        <div className="mt-1 flex items-center gap-1.5 border-t border-border-subtle px-2 pt-1.5">
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder={t('tickets.savedFilterNamePlaceholder')}
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface-card px-2 py-1 text-[12.5px] outline-none focus:border-brand-600"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!draftName.trim()}
            className="flex-none rounded-lg bg-brand-600 px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-brand-hover disabled:opacity-40"
          >
            {t('tickets.saveCurrentFilter')}
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
