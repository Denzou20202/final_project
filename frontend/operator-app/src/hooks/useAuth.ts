import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  changeOwnPassword,
  confirmTwoFactor,
  disableTwoFactor,
  logout as logoutRequest,
  setupTwoFactor,
} from '../lib/api/auth.api.js';
import { createTelegramLinkToken, fetchMe, updateOwnProfile } from '../lib/api/users.api.js';
import { disconnectChatSocket } from '../lib/socket.js';
import { useAuthStore } from '../store/auth.store.js';
import { useRecentActivityStore } from '../store/recent-activity.store.js';
import { useSidebarHighlightStore } from '../store/sidebar-highlight.store.js';

export function useCurrentUser() {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: !!accessToken,
    staleTime: 60_000,
  });
}

export function useUpdateOwnProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateOwnProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });
}

// «Мои настройки → Telegram» — no `['me']` invalidation on purpose:
// `me.telegramLinked` only flips to true once the person actually taps the
// returned link and completes /start in Telegram, an out-of-band action
// this mutation can't know happened (mirrors client-portal's identical
// hook).
export function useCreateTelegramLinkToken() {
  return useMutation({ mutationFn: createTelegramLinkToken });
}

// ===== 2FA self-service (own account, «Мои настройки → Безопасность») =====

export function useSetupTwoFactor() {
  return useMutation({ mutationFn: setupTwoFactor });
}

export function useConfirmTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ secret, token }: { secret: string; token: string }) => confirmTwoFactor(secret, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useDisableTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ password, token }: { password: string; token: string }) => disableTwoFactor(password, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });
}

// Any role — see changeOwnPassword's own comment in auth.api.ts. No
// ['me'] invalidation needed: nothing about the returned user object
// changes from a password swap.
export function useChangeOwnPassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword, totpCode }: { currentPassword: string; newPassword: string; totpCode?: string }) =>
      changeOwnPassword(currentPassword, newPassword, totpCode),
  });
}

// No useLogin here — operator-app has no login form of its own, see
// ProtectedRoute.tsx. Login only ever happens on client-portal's /login.
export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutRequest,
    onSettled: () => {
      clear();
      // Not user-scoped in storage — must be wiped on logout, or the next
      // person on this workstation inherits the previous operator's
      // highlighted status folders / recent-activity dots.
      useSidebarHighlightStore.getState().clearAll();
      useRecentActivityStore.getState().clearAll();
      disconnectChatSocket();
      queryClient.clear();
      // Real navigation, not react-router's navigate() — this app has no
      // /login route of its own to land on. Same re-assignment-loop guard
      // as ProtectedRoute/api/client.ts.
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    },
  });
}
