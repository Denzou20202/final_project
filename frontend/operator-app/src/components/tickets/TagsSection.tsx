import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAddTag, useAllTags, useRemoveTag, useTicketTags } from '../../hooks/useTags.js';
import { getErrorMessage } from '../../lib/errors.js';
import { pickLocalized } from '../../lib/localized.js';

export function TagsSection({ ticketId }: { ticketId: string }) {
  const { t, i18n } = useTranslation();
  const { data: tags } = useTicketTags(ticketId);
  const { data: allTags } = useAllTags();
  const addTag = useAddTag(ticketId);
  const removeTag = useRemoveTag(ticketId);
  const [draft, setDraft] = useState('');
  const [isOpen, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const existingNames = new Set((tags ?? []).map((t) => t.name));
  const suggestions = (allTags ?? []).filter((t) => !existingNames.has(t.name));

  const matches = useMemo(() => {
    const term = draft.trim().toLowerCase();
    if (!term) return suggestions;
    return suggestions.filter((t) => t.name.toLowerCase().includes(term));
  }, [suggestions, draft]);

  // Rendered through a portal, positioned `fixed` from the input's own rect
  // — this panel scrolls (`overflow-y-auto`), which per the CSS spec clips
  // anything overflowing past it the same way the ticket table's column
  // popover did (see ColumnSettingsPopover). Escaping via a portal sidesteps
  // that instead of fighting it with z-index; re-anchoring on scroll/resize
  // (capture phase reaches the panel's inner scroller) keeps the dropdown
  // glued to the input while the panel moves under it.
  useEffect(() => {
    if (!isOpen) return;
    function reposition() {
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  function submitTag(name: string) {
    // Same guard ChatPanel's composer already has for exactly this reason —
    // without it, Enter (handleKeyDown below) bypasses the submit button's
    // own `disabled={... || addTag.isPending}`: `draft` only clears on
    // success, so a second Enter fired while the first mutation is still in
    // flight (e.g. the admin clicking back into the input to check whether
    // anything happened, which reopens the dropdown with the same match
    // still highlighted) re-submits the same tag a second time.
    if (addTag.isPending) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    addTag.mutate(trimmed, { onSuccess: () => setDraft('') });
    setOpen(false);
  }

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    submitTag(draft);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || matches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      submitTag(matches[highlighted]?.name ?? draft);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const addError = addTag.error ? getErrorMessage(addTag.error) : undefined;

  return (
    <div className="border-b border-border p-4">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{t('tags.title')}</div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {(tags ?? []).map((tag) => (
          <span
            key={tag.id}
            className="flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11.5px] font-medium text-brand-700"
          >
            {pickLocalized(tag.name, tag.nameUk, tag.nameEn, i18n.language)}
            <button
              type="button"
              onClick={() => removeTag.mutate(tag.id)}
              className="text-brand-400 hover:text-priority-urgent"
              aria-label={t('tags.removeAria', { name: tag.name })}
            >
              ×
            </button>
          </span>
        ))}
        {(tags ?? []).length === 0 && <span className="text-[12.5px] text-ink-faint">{t('tags.none')}</span>}
      </div>

      <form onSubmit={handleAdd} className="flex gap-1.5">
        <div ref={wrapperRef} className="min-w-0 flex-1">
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setHighlighted(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={t('tags.addPlaceholder')}
            className="w-full rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand-600"
          />
        </div>
        <button
          type="submit"
          disabled={!draft.trim() || addTag.isPending}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-brand-hover disabled:opacity-40"
        >
          +
        </button>
      </form>
      {addError && <p className="mt-1.5 text-xs text-priority-urgent">{addError}</p>}

      {isOpen &&
        matches.length > 0 &&
        coords &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{ top: coords.top, left: coords.left, width: coords.width }}
            className="fixed z-40 max-h-48 overflow-y-auto rounded-lg border border-border bg-surface-card py-1 shadow-lg"
          >
            {matches.map((tag, index) => (
              <button
                key={tag.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => submitTag(tag.name)}
                className={`block w-full truncate px-2.5 py-1.5 text-left text-[12.5px] ${
                  index === highlighted ? 'bg-surface-muted' : 'hover:bg-surface-muted'
                }`}
              >
                {pickLocalized(tag.name, tag.nameUk, tag.nameEn, i18n.language)}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
