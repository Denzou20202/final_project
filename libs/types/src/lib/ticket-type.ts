import type { TicketType } from './enums.js';

// Shared shape for a row in the admin-managed `ticket_types` catalog — used
// both as the embedded `type` field on PublicTicket (ticket-service) and
// wherever a ticket type needs rendering, same pattern as
// PublicTicketStatus.
export interface PublicTicketType {
  id: string;
  // Set ONLY on the 4 seeded rows (incident/service_request/problem/
  // question) — lets frontends keep using the existing `ticketType.<key>`
  // i18n keys for those. Admin-created custom types (key: null) instead rely
  // on nameUk/nameEn below (auto-filled via DeepL, editable by the admin) —
  // pick the right one via pickLocalized(name, nameUk, nameEn, locale), same
  // pattern as Tags/Custom Fields/ticket statuses.
  key: TicketType | null;
  name: string;
  nameUk: string | null;
  nameEn: string | null;
  color: string;
  // Exactly one type has this true — the default for new tickets that don't
  // pass an explicit typeId at creation.
  isDefault: boolean;
  // Report builder's weighted-KPI multiplier for this type (see
  // ReportsRepository.groupedReport) — 1 is neutral.
  weight: number;
  sortOrder: number;
}
