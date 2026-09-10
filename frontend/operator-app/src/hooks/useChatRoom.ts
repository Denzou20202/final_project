import { useCallback, useEffect, useRef, useState } from 'react';
import { getChatSocket } from '../lib/socket.js';
import type { PublicComment } from '../lib/types.js';

const TYPING_TIMEOUT_MS = 3000;
// Well under TYPING_TIMEOUT_MS so continuous typing never lets the other
// side's indicator flicker off between emits — just caps how often this
// component's caller (fired on every keystroke from the editor's onUpdate)
// actually reaches the socket, same intent as the ticket-list search box's
// debounce elsewhere in this app.
const TYPING_THROTTLE_MS = 1500;

export function useChatRoom(ticketId: string) {
  const [messages, setMessages] = useState<PublicComment[]>([]);
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const [viewerIds, setViewerIds] = useState<string[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const socket = getChatSocket();
    setMessages([]);
    setTypingUserId(null);
    setViewerIds([]);

    // Tagged with ticketId server-side specifically so this can be filtered
    // like every sibling handler below — a slow, still-in-flight response to
    // a PREVIOUS ticket's join (fast row-to-row navigation) can otherwise
    // land after this ticket's own listener is registered and get shown as
    // this ticket's history.
    function onHistory(payload: { ticketId: string; history: PublicComment[] }) {
      if (payload.ticketId === ticketId) {
        setMessages(payload.history);
      }
    }
    function onMessage(comment: PublicComment) {
      // Rooms are per-ticket, but guard anyway in case a stale room
      // membership from a previous ticket hasn't been left yet.
      if (comment.ticketId === ticketId) {
        setMessages((prev) => [...prev, comment]);
      }
    }
    function onMessageEdited(comment: PublicComment) {
      if (comment.ticketId === ticketId) {
        setMessages((prev) => prev.map((m) => (m.id === comment.id ? comment : m)));
      }
    }
    function onTyping(payload: { userId: string; ticketId: string }) {
      if (payload.ticketId !== ticketId) return;
      setTypingUserId(payload.userId);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTypingUserId(null), TYPING_TIMEOUT_MS);
    }
    function onViewers(payload: { ticketId: string; viewerIds: string[] }) {
      if (payload.ticketId === ticketId) {
        setViewerIds(payload.viewerIds);
      }
    }
    // The gateway's handleConnection only rejoins userRoom/OPERATORS_ROOM on
    // (re)connect, not ticketRoom — that only happens via this ticket:join
    // emit. Without re-emitting it here too, a socket.io auto-reconnect
    // after a network blip leaves the client silently out of the ticket's
    // room: no more messages/edits/typing/viewers until they navigate away
    // and back. 'connect' fires on every successful (re)connection, not just
    // the first — no double-join risk for the current connection, since a
    // listener attached to an already-connected socket doesn't fire
    // retroactively (the explicit emit below covers that case instead).
    function onConnect() {
      socket.emit('ticket:join', { ticketId });
    }

    socket.on('ticket:history', onHistory);
    socket.on('ticket:message', onMessage);
    socket.on('ticket:message:edited', onMessageEdited);
    socket.on('ticket:typing', onTyping);
    socket.on('ticket:viewers', onViewers);
    socket.on('connect', onConnect);
    socket.emit('ticket:join', { ticketId });

    return () => {
      socket.emit('ticket:leave', { ticketId });
      socket.off('ticket:history', onHistory);
      socket.off('ticket:message', onMessage);
      socket.off('ticket:message:edited', onMessageEdited);
      socket.off('ticket:typing', onTyping);
      socket.off('ticket:viewers', onViewers);
      socket.off('connect', onConnect);
      clearTimeout(typingTimeoutRef.current);
    };
  }, [ticketId]);

  // Awaits the server's ack (the newly created comment) rather than firing
  // and forgetting — the composer's stage-then-send flow needs the real
  // comment id to attach any staged files to it. .timeout() turns a dropped
  // connection into a rejected promise instead of a send button stuck
  // "sending" forever.
  //
  // The gateway acks with `{ error: true, message }` (not a real comment)
  // when the send itself was rejected server-side (closed/trashed ticket,
  // no longer a participant, ...) — `err` here is ONLY ever socket.io's own
  // synthetic timeout error, never populated from an application-level
  // failure, so that rejection has to be detected from the acked value's
  // shape instead. Without this check, a rejected send silently resolved as
  // if it had succeeded, with no error and no real comment.
  const sendMessage = useCallback(
    (body: string, isInternal = false): Promise<PublicComment> => {
      return new Promise((resolve, reject) => {
        getChatSocket()
          .timeout(10000)
          .emit(
            'ticket:message',
            { ticketId, body, isInternal },
            (err: Error | null, response: PublicComment | { error: true; message: string }) => {
              if (err) reject(err);
              else if ('error' in response) reject(new Error(response.message));
              else resolve(response);
            },
          );
      });
    },
    [ticketId],
  );

  // Mirrors sendMessage's ack-based flow above — the gateway's
  // handleEditMessage now acks the same way handleMessage does (a real
  // comment on success, `{ error: true, message }` on a server-side
  // rejection), instead of being fire-and-forget. Same .timeout() and
  // error-shape check for the same reasons: a dropped connection becomes a
  // rejected promise instead of the caller waiting forever, and a rejected
  // edit is distinguishable from socket.io's own synthetic timeout error.
  const editMessage = useCallback(
    (commentId: string, body: string): Promise<PublicComment> => {
      return new Promise((resolve, reject) => {
        getChatSocket()
          .timeout(10000)
          .emit(
            'ticket:message:edit',
            { ticketId, commentId, body },
            (err: Error | null, response: PublicComment | { error: true; message: string }) => {
              if (err) reject(err);
              else if ('error' in response) reject(new Error(response.message));
              else resolve(response);
            },
          );
      });
    },
    [ticketId],
  );

  const lastTypingEmitRef = useRef(0);
  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingEmitRef.current < TYPING_THROTTLE_MS) return;
    lastTypingEmitRef.current = now;
    getChatSocket().emit('ticket:typing', { ticketId });
  }, [ticketId]);

  return { messages, typingUserId, viewerIds, sendMessage, editMessage, notifyTyping };
}
