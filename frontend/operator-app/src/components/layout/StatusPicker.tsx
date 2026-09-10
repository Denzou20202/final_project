import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useCurrentUser } from '../../hooks/useAuth.js';
import { useEmployeeStatuses } from '../../hooks/useEmployeeStatuses.js';
import { usePresence } from '../../hooks/usePresence.js';
import { pickLocalized } from '../../lib/localized.js';
import { getChatSocket } from '../../lib/socket.js';

const ONLINE_COLOR = '#22C55E';

// Own-status control in the Sidebar footer — click opens a small popover
// (portalled, same pattern as ColumnSettingsPopover) listing the
// admin-defined catalog plus «Онлайн» to clear back to the default. Picking
// one emits straight over the chat-service socket (see chat.gateway.ts's
// presence:set-status handler); the broadcast that follows is what actually
// updates everyone's usePresence() state, including this tab's own.
export function StatusPicker() {
  const { t, i18n } = useTranslation();
  const { data: me } = useCurrentUser();
  const { data: catalog } = useEmployeeStatuses();
  const { onlineOperatorIds, statuses } = usePresence();
  const [isOpen, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ bottom: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const myLive = me ? statuses[me.id] : undefined;
  const displayName = myLive?.name ?? t('statusPicker.online');
  const displayColor = myLive?.color ?? ONLINE_COLOR;

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  function toggleOpen() {
    if (isOpen) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      // Left-aligned to the anchor by default, but that runs the popover
      // (w-56 = 224px) off the right edge of the viewport when the anchor
      // sits near it — clamp so the whole box stays on screen.
      const POPOVER_WIDTH = 224;
      const MARGIN = 8;
      const left = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - MARGIN));
      setCoords({ bottom: window.innerHeight - rect.top + 4, left });
    }
    setOpen(true);
  }

  function pick(statusId: string | null) {
    getChatSocket().emit('presence:set-status', { statusId });
    setOpen(false);
  }

  return (
    <div className="min-w-0 flex-1">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        className="flex w-full min-w-0 flex-col rounded-lg text-left hover:bg-surface-muted"
      >
        {/* No `truncate` here on purpose — a Russian ФИО can run 2-3 words
            (see Sidebar.tsx's footer comment), and clipping it to one
            ellipsized line would hide the very name this control exists to
            show. line-clamp-3 wraps instead, with its own ellipsis if a
            name somehow runs past that. Dropping the old `items-start`
            (align-items: flex-start, the cross-axis on this flex-col) matters
            just as much: it let this div and the status row below size to
            their own content instead of stretching to the button's actual
            width, so truncate/line-clamp had no bound to clip against — the
            width just grew to fit whatever text was inside. */}
        <div className="line-clamp-3 break-words text-[12.5px] font-medium leading-snug">
          {me?.fullName ?? t('common.loading')}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-ink-subtle">
          <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ backgroundColor: displayColor }} />
          <span className="truncate">{displayName}</span>
        </div>
      </button>

      {isOpen &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ bottom: coords.bottom, left: coords.left }}
            className="fixed z-40 w-56 rounded-xl border border-border bg-surface-card p-1.5 shadow-lg"
          >
            <button
              type="button"
              onClick={() => pick(null)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-surface-muted"
            >
              <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: ONLINE_COLOR }} />
              {t('statusPicker.online')}
            </button>
            {(catalog ?? []).map((status) => (
              <button
                key={status.id}
                type="button"
                onClick={() => pick(status.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-surface-muted"
              >
                <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: status.color }} />
                <span className="truncate">{pickLocalized(status.name, status.nameUk, status.nameEn, i18n.language)}</span>
              </button>
            ))}
            {(catalog ?? []).length === 0 && (
              <div className="px-2.5 py-2 text-[12px] text-ink-faint">{t('statusPicker.noCustomStatuses')}</div>
            )}
            <div className="mt-1 border-t border-border-subtle px-2.5 pt-1.5 text-[11px] text-ink-faint">
              {t('statusPicker.onlineCount', { count: onlineOperatorIds.length })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
