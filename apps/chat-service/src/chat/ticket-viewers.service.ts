import { Injectable } from '@nestjs/common';

// In-memory, mirrors PresenceService's shape but scoped per-ticket instead
// of globally — "who else has this ticket open right now". Same
// single-instance caveat: would need Redis to scale past one chat-service
// process.
//
// Keyed by socketId (not a raw per-user counter like PresenceService) —
// join() must be idempotent for the SAME socket, because the frontend can
// legitimately emit ticket:join twice for one page view: once buffered
// before the socket finishes connecting, once again from the socket's own
// 'connect' handler (socket.io-client flushes buffered emits before firing
// 'connect' listeners, so both packets reach the server). A raw counter
// drifts permanently positive the first time that race fires, since exactly
// one 'ticket:leave'/disconnect ever balances it back out — a viewer never
// leaves. Re-adding the same socketId here is a no-op, so a duplicate join
// from the same connection can't inflate the count; two DIFFERENT sockets
// for the same user (two tabs) still both count, same as before.
@Injectable()
export class TicketViewersService {
  private readonly viewersByTicket = new Map<string, Map<string, string>>();

  join(ticketId: string, socketId: string, userId: string): void {
    let viewers = this.viewersByTicket.get(ticketId);
    if (!viewers) {
      viewers = new Map();
      this.viewersByTicket.set(ticketId, viewers);
    }
    viewers.set(socketId, userId);
  }

  leave(ticketId: string, socketId: string): void {
    const viewers = this.viewersByTicket.get(ticketId);
    if (!viewers) return;
    viewers.delete(socketId);
    if (viewers.size === 0) this.viewersByTicket.delete(ticketId);
  }

  getViewerIds(ticketId: string): string[] {
    const viewers = this.viewersByTicket.get(ticketId);
    if (!viewers) return [];
    return [...new Set(viewers.values())];
  }
}
