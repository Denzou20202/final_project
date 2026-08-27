// Fixed rows seeded by the AddTicketStatuses migration (libs/database/src/migrations)
// — the 4 well-known statuses every ticket lifecycle started with, before
// admins could add their own. Referenced by the migration's own INSERT/
// backfill SQL and by the automation_rules jsonb remap it runs in the same
// pass. NOT meant for runtime app logic — that should always resolve a
// status via its `isDefault`/`isClosed`/`tracksSla`/`key` flags (see
// PublicTicketStatus), never by hardcoding one of these ids. Same
// single-source-of-truth caveat as SYSTEM_USER_ID: keep these literals in
// sync by hand with the migration's raw SQL if either ever changes.
export const SEEDED_TICKET_STATUS_IDS = {
  OPEN: '00000000-0000-4000-8000-000000000101',
  PENDING: '00000000-0000-4000-8000-000000000102',
  RESOLVED: '00000000-0000-4000-8000-000000000103',
  CLOSED: '00000000-0000-4000-8000-000000000104',
} as const;
