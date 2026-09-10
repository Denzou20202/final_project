import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/auth.store.js';

const CHAT_SERVICE_URL = import.meta.env['VITE_CHAT_SERVICE_URL'] ?? 'http://localhost:3004';

let socket: Socket | null = null;

// One socket connection per session (not per component) — components join/
// leave ticket rooms on top of this shared connection rather than opening
// their own.
export function getChatSocket(): Socket {
  // Empty string in production (see .env.production) means "same origin,
  // proxied through nginx" — socket.io-client only does that default when
  // no uri is passed at all, so an empty string must become undefined here
  // rather than being passed through as a literal (invalid) URL.
  socket ??= io(CHAT_SERVICE_URL || undefined, {
    // A plain object here is captured once at creation time — socket.io-
    // client only re-reads it on each (re)connect attempt when it's a
    // function. Access tokens expire (15min default); without this, any
    // auto-reconnect after expiry resends the original stale token,
    // chat-service's WsAuthService rejects it, and live chat/notifications
    // silently die until a full page reload.
    auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
    autoConnect: true,
    transports: ['websocket'],
  });
  return socket;
}

// The socket authenticates once, at handshake time, with whatever token was
// current then. If a different user logs in later in the same tab, a stale
// connection would keep acting as the previous user — so logout tears it
// down and the next getChatSocket() call reconnects with the new token.
export function disconnectChatSocket(): void {
  socket?.disconnect();
  socket = null;
}
