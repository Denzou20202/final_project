import type { TicketStatus } from './enums.js';

// Shared shape for a row in the admin-managed `ticket_statuses` catalog —
// used both as the embedded `status` field on PublicTicket (ticket-service)
// and on TicketEventPayload (WS/Redis), so every consumer that already does
// `<StatusBadge status={ticket.status}/>` keeps working unchanged.
export interface PublicTicketStatus {
  id: string;
  // Set ONLY on the 4 seeded rows (open/pending/resolved/closed) — lets
  // frontends/telegram-bot keep using the existing `ticketStatus.<key>`
  // i18n keys for those. Admin-created custom statuses (key: null) instead
  // rely on nameUk/nameEn below (auto-filled via DeepL, editable by the
  // admin) — pick the right one via pickLocalized(name, nameUk, nameEn,
  // locale), same pattern as Tags/Custom Fields/etc.
  key: TicketStatus | null;
  name: string;
  nameUk: string | null;
  nameEn: string | null;
  color: string;
  // Exactly one status has this true — the default for new tickets and the
  // anchor for the "Неприсвоенные" (unassigned) folder, which is
  // deliberately not its own status value (see DropNewTicketStatus
  // migration) but "the default status + no assignee".
  isDefault: boolean;
  // Zero or more statuses may have this true — triggers closedAt, the CSAT
  // survey, chat message-locking, and the close-requires-assignee guard.
  isClosed: boolean;
  // Whether tickets in this status still count toward SLA breach tracking
  // (seed: open/pending=true, resolved/closed=false).
  tracksSla: boolean;
  sortOrder: number;
}
