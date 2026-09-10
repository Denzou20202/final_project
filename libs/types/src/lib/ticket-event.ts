// Redis pub/sub contract for ephemeral, best-effort live UI updates — NOT the
// same concern as the BullMQ `notifications` queue (libs/common), which is
// for reliable, retried, persisted email delivery. A missed pub/sub message
// just means an operator's dashboard doesn't flash right away; nothing is lost.
export const TICKET_EVENTS_CHANNEL = 'ticket-events';

import type { PublicTicketStatus } from './ticket-status.js';

export type TicketEventType = 'created' | 'assigned' | 'reply' | 'mention' | 'updated' | 'attachment';

export interface TicketEventPayload {
  type: TicketEventType;
  ticketId: string;
  ticketNumber: number;
  title: string;
  // When set, the event is for ONE specific user (e.g. 'assigned' → the new
  // assignee, 'updated' → the ticket's own client) — the chat-service
  // subscriber routes it to that user's own socket room instead of
  // broadcasting to every operator. Absent = a genuinely shared event
  // ('created' in the common queue, or 'updated' broadcast to operators).
  targetUserId?: string;
  // The ticket's status at the moment of the event — lets the sidebar
  // highlight the one status folder ('created' → always "Новые", 'reply'/
  // 'updated' → whatever folder the ticket currently sits in) without a
  // follow-up fetch.
  status?: PublicTicketStatus;
  // The user who caused the event — excluded from a broadcast delivery, so
  // an operator who files a ticket on a client's behalf doesn't get a
  // «Новый тикет» toast (and folder highlight) for their own action.
  // Chat-path replies don't need this: the gateway's client.to(...) already
  // omits the sending socket.
  excludeUserId?: string;
  // The ticket's own department/assignee/owner at the moment of the event —
  // used BOTH for delivery (chat-service's TicketEventsSubscriberService
  // feeds these straight into ChatGateway.emitToStaffWhoCanSeeTicket, which
  // only delivers a shared event to a staff socket that passes
  // staffCanSeeTicket for it — a department- or own-tickets-restricted
  // operator never receives the payload at all for a ticket outside their
  // scope) AND so the RECEIVING client can apply the exact same predicate
  // itself for anything derived from an event it DID legitimately receive
  // (e.g. sidebar folder highlighting) — see staffCanSeeTicket,
  // libs/common/src/permissions/staff-ticket-visibility.ts, the single
  // source of truth both sides call.
  teamId?: string | null;
  assignedTo?: string | null;
  createdBy: string;
  // True only for the 'updated' events broadcastTicketUpdated fires with
  // actorId: null — SlaEscalationService's cron job and the Dispatcher's
  // applyAutomated* actions, never a human-initiated edit (which always has
  // a real actorId). Lets a recipient distinguish "SLA/automation touched
  // this ticket" from routine manual edits without a second event type.
  automated?: boolean;
}
