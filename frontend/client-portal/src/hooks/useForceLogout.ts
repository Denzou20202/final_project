import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  // react-router's navigate() (under this app's plain <BrowserRouter>, not a
  // data router) isn't referentially stable — it changes identity on every
  // pathname change. Reading it via a ref, instead of putting it in the
  // effect's own dependency array, keeps the socket listener registered once
  // for the tab's whole session instead of tearing down and re-adding on
  // every ticket-list <-> ticket-detail navigation.
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    const socket = getChatSocket();
    function onDeactivated() {
      clear();
      disconnectChatSocket();
      queryClient.clear();
      useSidebarHighlightStore.getState().clearAll();
      useRecentActivityStore.getState().clearAll();
      navigateRef.current('/login', { replace: true });
    }
    socket.on('account:deactivated', onDeactivated);
    return () => {
      socket.off('account:deactivated', onDeactivated);
    };
  }, [clear, queryClient]);
}
