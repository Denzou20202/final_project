import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playNotificationSound, showNotification } from '../lib/notify.js';
import { getChatSocket } from '../lib/socket.js';
import type { TicketEventPayload } from '../lib/types.js';
import { useNotificationPreferencesStore } from '../store/notification-preferences.store.js';
import { useRecentActivityStore } from '../store/recent-activity.store.js';
import { useSidebarHighlightStore } from '../store/sidebar-highlight.store.js';

export interface ToastItem extends TicketEventPayload {
  id: string;
}

const TOAST_LIFETIME_MS = 8000;

export function useTicketNotifications() {
  const { t } = useTranslation();
  // A client mainly sees 'reply' and 'updated' here — 'created'/'assigned'
  // route only to the operators room (chat.gateway.ts), never to a client's
  // own room, but the shared TicketEventPayload shape covers all four so
  // this doesn't silently break if that ever changes. Rebuilt on language
  // change (and re-read by the socket effect below, via its dependency
  // array) so a push notification fired after a language switch uses the
  // new language.
  const MESSAGES = useMemo<Record<TicketEventPayload['type'], string>>(
    () => ({
      created: t('notifications.created'),
      assigned: t('notifications.assigned'),
      reply: t('notifications.reply'),
      updated: t('notifications.updated'),
    }),
    [t],
  );
  // The backend's 'updated' event fires for every ticket mutation (status,
  // priority, assignee, team, title/description, merge) — the client's own
  // live query refresh below needs ALL of them to stay in sync without a
  // manual reload, but a user-visible notification should only ever fire
  // for the one 'updated' case the client actually cares about: their
  // ticket got closed. Kept as its own key rather than repurposing
  // MESSAGES.updated, since that generic text is otherwise unreachable now.
  const closedMessage = useMemo(() => t('notifications.closed'), [t]);
  const messageFor = useCallback(
    (item: Pick<TicketEventPayload, 'type' | 'status'>): string =>
      item.type === 'updated' && item.status?.isClosed ? closedMessage : MESSAGES[item.type],
    [closedMessage, MESSAGES],
  );
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const queryClient = useQueryClient();
  const markActive = useRecentActivityStore((s) => s.markActive);
  const markFolderActive = useSidebarHighlightStore((s) => s.markActive);
  const markUnassignedFolderActive = useSidebarHighlightStore((s) => s.markUnassignedActive);
  const soundEnabled = useNotificationPreferencesStore((s) => s.soundEnabled);
  const pushEnabled = useNotificationPreferencesStore((s) => s.pushEnabled);

  useEffect(() => {
    const socket = getChatSocket();

    function onNotification(payload: TicketEventPayload) {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket', payload.ticketId] });
      queryClient.invalidateQueries({ queryKey: ['ticket-counts'] });
      markActive(payload.ticketId);
      // No permission-scoping concern here (unlike operator-app's copy of
      // this same check) — every event a client's socket receives is
      // already targeted at them specifically (targetUserId), never a
      // room-wide broadcast, so it's always about one of their own tickets.
      if ((payload.type === 'created' || payload.type === 'reply' || payload.type === 'updated') && payload.status) {
        if (payload.status.isDefault && !payload.assignedTo) {
          markUnassignedFolderActive(payload.ticketId);
        } else {
          markFolderActive(payload.ticketId, payload.status.id);
        }
      }

      // A client should only ever be notified (toast/sound/push) for a
      // reply, a new ticket filed on their behalf, or their ticket being
      // closed — every other operator action (status change short of
      // closing, priority, assignee, team, ...) still refreshes the data
      // above (so the ticket page/list reflect it live) but stays silent,
      // per explicit product decision: those are staff-internal workflow
      // steps, not something the client needs surfaced.
      const isNotificationWorthy =
        payload.type === 'reply' || payload.type === 'created' || (payload.type === 'updated' && payload.status?.isClosed);
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
      // on every preference change (same pattern as operator-app).
      if (useNotificationPreferencesStore.getState().soundEnabled) {
        playNotificationSound();
      }
      if (useNotificationPreferencesStore.getState().pushEnabled) {
        showNotification(messageFor(payload), `#${payload.ticketNumber} · ${payload.title}`);
      }
    }

    // See operator-app's copy of this hook for the full reasoning — a
    // reconnect (proxy/LB idle timeout, laptop sleep/wake, chat-service
    // restart) otherwise leaves the ticket list/counts/detail view silently
    // stale until something else happens to touch these queries.
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
  }, [queryClient, markActive, markFolderActive, markUnassignedFolderActive, messageFor]);

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return {
    toasts,
    dismiss,
    messageFor,
    soundEnabled,
    pushEnabled,
  };
}
