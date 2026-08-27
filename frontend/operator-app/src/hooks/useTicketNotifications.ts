import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { decodeJwtPayload } from '../lib/jwt.js';
import { playNotificationSound, showNotification } from '../lib/notify.js';
import { getChatSocket } from '../lib/socket.js';
import { canSeeTicket } from '../lib/staff-visibility.js';
import type { TicketEventPayload } from '../lib/types.js';
import { useAuthStore } from '../store/auth.store.js';
import { useNotificationPreferencesStore } from '../store/notification-preferences.store.js';
import { useRecentActivityStore } from '../store/recent-activity.store.js';
import { useSidebarHighlightStore } from '../store/sidebar-highlight.store.js';

export interface ToastItem extends TicketEventPayload {
  id: string;
}

const TOAST_LIFETIME_MS = 8000;

export function useTicketNotifications() {
  const { t } = useTranslation();
  // Rebuilt on language change (and re-read by the socket effect below, via
  // its dependency array) so a browser push notification fired after a
  // language switch uses the new language, not whatever was active when
  // the listener was first registered.
  const MESSAGES = useMemo<Record<TicketEventPayload['type'], string>>(
    () => ({
      created: t('notifications.created'),
      assigned: t('notifications.assigned'),
      reply: t('notifications.reply'),
      mention: t('notifications.mention'),
      updated: t('notifications.updated'),
    }),
    [t],
  );
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const queryClient = useQueryClient();
  const soundEnabled = useNotificationPreferencesStore((s) => s.soundEnabled);
  const pushEnabled = useNotificationPreferencesStore((s) => s.pushEnabled);
  const markActive = useRecentActivityStore((s) => s.markActive);
  const markFolderActive = useSidebarHighlightStore((s) => s.markActive);
  const markUnassignedFolderActive = useSidebarHighlightStore((s) => s.markUnassignedActive);

  useEffect(() => {
    const socket = getChatSocket();

    function onNotification(payload: TicketEventPayload) {
      // The broadcast itself reaches every connected operator regardless of
      // permission-group restrictions (OPERATORS_ROOM has no per-recipient
      // filter — see chat.gateway.ts) — unlike the counts/list, which the
      // server already scopes via computeStaffRestrictions. So the
      // visibility check happens here, client-side, against the actor's own
      // JWT-embedded restriction snapshot, mirroring staffCanSeeTicket
      // exactly (see staff-visibility.ts) — a restricted operator must not
      // see their sidebar light up (or pay for a network round-trip whose
      // answer can only ever be "nothing changed") for a ticket outside
      // their departments. Computed once, up front, since it now gates both
      // the highlight below AND the invalidations right after it.
      const actor = decodeJwtPayload(useAuthStore.getState().accessToken ?? '');
      const isVisible =
        !actor ||
        canSeeTicket(actor, { createdBy: payload.createdBy, assignedTo: payload.assignedTo, teamId: payload.teamId });

      // ['tickets']/['ticket-counts'] feed the list page and every sidebar
      // folder/team/tag row org-wide — refetching them for a ticket this
      // operator can't even see would just re-confirm the exact same
      // numbers (the server already scopes both queries), at the cost of a
      // real round-trip plus a full re-render of every row. ['ticket', id]
      // stays unconditional: if this operator can't see the ticket, nothing
      // has that query mounted anyway, so invalidating it is a no-op either way.
      // 'mention' always invalidates too, even when isVisible is false — a
      // mention on an out-of-department ticket is exactly the case where
      // this operator's «Упоминания» folder/badge (tickets.repository.ts's
      // mentionedId filter) needs to pick up the new ticket live, and
      // isVisible has no idea that filter exists (it mirrors
      // staffCanSeeTicket, not the mention bypass).
      if (isVisible || payload.type === 'mention') {
        queryClient.invalidateQueries({ queryKey: ['tickets'] });
        queryClient.invalidateQueries({ queryKey: ['ticket-counts'] });
      }
      queryClient.invalidateQueries({ queryKey: ['ticket', payload.ticketId] });
      markActive(payload.ticketId);
      // These three types are about "a status folder now has something new
      // to look at" (including a ticket moving between folders on an
      // 'updated' status change) — 'assigned'/'mention' are personal
      // call-outs, not a folder-level signal, and highlighting a folder for
      // them would fire even for tickets the recipient already knows all about.
      if (
        isVisible &&
        (payload.type === 'created' || payload.type === 'reply' || payload.type === 'updated') &&
        payload.status
      ) {
        // Default-status + no assignee lives in «Неприсвоенные», a folder
        // separate from that status's own «В работе»-equivalent folder (see
        // Sidebar.tsx's showUnassigned/showStatus split) — routing purely on
        // status would light up a folder this ticket isn't even filtered into.
        if (payload.status.isDefault && !payload.assignedTo) {
          markUnassignedFolderActive(payload.ticketId);
        } else {
          markFolderActive(payload.ticketId, payload.status.id);
        }
      }

      // A toast/sound/push should only fire for something this operator
      // personally needs to act on: they were assigned, mentioned, a new
      // ticket landed in the shared queue, a reply came in on a ticket
      // they're the assignee of, or SLA/automation touched a ticket
      // (routine manual edits — status/priority/team/etc by a colleague —
      // and attachment uploads stay silent here; the invalidations above
      // already keep the list/ticket page live for those). 'assigned' and
      // 'mention' are always personal call-outs (targeted delivery, see
      // chat.gateway.ts) so they're never held back by isVisible — the
      // department-restriction check exists to filter room-wide broadcasts,
      // not to second-guess a ticket someone was deliberately handed.
      const isNotificationWorthy =
        payload.type === 'assigned' ||
        payload.type === 'mention' ||
        (isVisible && payload.type === 'created') ||
        (isVisible && payload.type === 'reply' && payload.assignedTo === actor?.sub) ||
        (isVisible && payload.type === 'updated' && payload.automated === true);
      if (!isNotificationWorthy) {
        return;
      }

      const toast: ToastItem = { ...payload, id: `${payload.ticketId}-${Date.now()}` };
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, TOAST_LIFETIME_MS);

      // Preferences are read fresh via getState() rather than closed over —
      // this listener is registered once per socket lifetime, not re-bound
      // on every preference change.
      if (useNotificationPreferencesStore.getState().soundEnabled) {
        playNotificationSound();
      }
      if (useNotificationPreferencesStore.getState().pushEnabled) {
        showNotification(MESSAGES[payload.type], `#${payload.ticketNumber} · ${payload.title}`);
      }
    }

    // A reconnect (proxy/LB idle timeout, laptop sleep/wake, chat-service
    // restart) is otherwise invisible to this app: nothing invalidates
    // ['tickets']/['ticket-counts']/an open ticket's own query, so the
    // list/sidebar/detail view silently keep showing whatever was current
    // right before the drop — any status/priority/assignee change that
    // happened elsewhere during the gap is missed until something else
    // happens to touch these queries. socket.io's 'connect' fires on the
    // initial connection too, not just reconnects — an extra refetch there
    // is harmless.
    function onConnect() {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-counts'] });
      queryClient.invalidateQueries({ queryKey: ['ticket'] });
    }

    socket.on('ticket:notification', onNotification);
    socket.on('connect', onConnect);
    return () => {
      socket.off('ticket:notification', onNotification);
      socket.off('connect', onConnect);
    };
  }, [queryClient, markActive, markFolderActive, markUnassignedFolderActive, MESSAGES]);

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return {
    toasts,
    dismiss,
    messageFor: (type: TicketEventPayload['type']) => MESSAGES[type],
    soundEnabled,
    pushEnabled,
  };
}
