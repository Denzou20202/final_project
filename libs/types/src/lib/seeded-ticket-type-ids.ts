// Fixed rows seeded by the AddTicketTypes migration (libs/database/src/migrations)
// — the 4 well-known types every ticket started with, before admins could
// add their own. Referenced by the migration's own INSERT/backfill SQL.
// NOT meant for runtime app logic — that should always resolve a type via
// its `isDefault`/`key` flags (see PublicTicketType), never by hardcoding
// one of these ids. Same single-source-of-truth caveat as
// SEEDED_TICKET_STATUS_IDS/SYSTEM_USER_ID: keep these literals in sync by
// hand with the migration's raw SQL if either ever changes.
export const SEEDED_TICKET_TYPE_IDS = {
  INCIDENT: '00000000-0000-4000-8000-000000000201',
  SERVICE_REQUEST: '00000000-0000-4000-8000-000000000202',
  PROBLEM: '00000000-0000-4000-8000-000000000203',
  QUESTION: '00000000-0000-4000-8000-000000000204',
} as const;
