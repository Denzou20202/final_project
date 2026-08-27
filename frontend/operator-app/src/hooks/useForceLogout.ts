import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { disconnectChatSocket, getChatSocket } from '../lib/socket.js';
import { useAuthStore } from '../store/auth.store.js';
import { useRecentActivityStore } from '../store/recent-activity.store.js';
import { useSidebarHighlightStore } from '../store/sidebar-highlight.store.js';

// Server-initiated equivalent of useLogout — fires when an admin deactivates
// this account while the tab is still open (see ChatGateway.forceDisconnectUser).
// Mirrors useLogout's onSettled cleanup exactly, minus the POST /auth/logout
// call itself: the account is already deactivated server-side, there's
// nothing left to revoke.
export function useForceLogout() {
  const clear = useAuthStore((s) => s.clear);
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getChatSocket();
    function onDeactivated() {
      clear();
      useSidebarHighlightStore.getState().clearAll();
      useRecentActivityStore.getState().clearAll();
      disconnectChatSocket();
      queryClient.clear();
      // Same re-assignment-loop guard as ProtectedRoute/api/client.ts.
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    socket.on('account:deactivated', onDeactivated);
    return () => {
      socket.off('account:deactivated', onDeactivated);
    };
  }, [clear, queryClient]);
}
