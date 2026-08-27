import type { RegistrationPendingEvent } from '@veloxdesk/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { approveRegistration, fetchPendingRegistrations, rejectRegistration } from '../lib/api/users.api.js';
import { playNotificationSound, showNotification } from '../lib/notify.js';
import { getChatSocket } from '../lib/socket.js';
import { useNotificationPreferencesStore } from '../store/notification-preferences.store.js';

const PENDING_REGISTRATIONS_KEY = ['pending-registrations'];

// `enabled` should be `isAdmin` at every call site — a non-admin session
// would get a 403 from GET /users/pending anyway, and there's no reason to
// subscribe to an admin-only socket event (ADMINS_ROOM) it will never
// receive. Powers both the IconRail badge count and the modal's list — same
// query key, so react-query shares one cache entry across both.
export function usePendingRegistrations(enabled: boolean) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const socket = getChatSocket();
    function onPending(payload: RegistrationPendingEvent) {
      queryClient.invalidateQueries({ queryKey: PENDING_REGISTRATIONS_KEY });
      // Preferences read fresh via getState(), not closed over — same
      // reasoning as useTicketNotifications: this listener is registered
      // once per socket lifetime, not re-bound on every preference change.
      // ADMINS_ROOM already scopes this event to admins only (see
      // chat.gateway.ts's handleConnection), so no extra visibility check
      // is needed here the way ticket notifications need one.
      if (useNotificationPreferencesStore.getState().soundEnabled) {
        playNotificationSound();
      }
      if (useNotificationPreferencesStore.getState().pushEnabled) {
        showNotification(t('notifications.registrationPending'), `${payload.fullName} · ${payload.email}`);
      }
    }
    socket.on('user:registration-pending', onPending);
    return () => {
      socket.off('user:registration-pending', onPending);
    };
  }, [enabled, queryClient, t]);

  return useQuery({
    queryKey: PENDING_REGISTRATIONS_KEY,
    queryFn: fetchPendingRegistrations,
    enabled,
    staleTime: 30_000,
    // The socket event is the primary update path and normally all this
    // needs — but this query is 100% dependent on it otherwise (this app
    // disables refetchOnWindowFocus globally, and there's no other trigger),
    // so a missed event (a dropped socket, a Redis hiccup on the publish
    // side) would otherwise leave the badge/list stale indefinitely with no
    // way to self-correct. A minute is frequent enough to be a real safety
    // net without adding meaningful load — this is one small, indexed query,
    // polled while the tab is actually in the foreground.
    refetchInterval: 60_000,
  });
}

export function useApproveRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: approveRegistration,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PENDING_REGISTRATIONS_KEY }),
  });
}

export function useRejectRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: rejectRegistration,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PENDING_REGISTRATIONS_KEY }),
  });
}
