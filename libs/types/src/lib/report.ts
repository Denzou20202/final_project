import { TicketPriority } from './enums.js';

// What a report's rows are grouped into — one row per <dimension value>.
// TAG and SLA_POLICY join through a side table (a ticket can carry several
// tags, so TAG rows aren't a 1:1 partition of tickets like the others are).
// PERIOD buckets by date_trunc(periodBucket, <the filters.dateField column>)
// instead of a ticket attribute — see ReportFilters.periodBucket below.
export enum ReportGroupBy {
  ASSIGNEE = 'assignee',
  CLIENT = 'client',
  // Not a relational entity yet (see the roadmap's "Организации/компании"
  // item) — this groups by UserEntity.company, the client's own free-text
  // company name (see that entity's comment for why it's not `teams`).
  COMPANY = 'company',
  TEAM = 'team',
  // Direct 1:1 column on TicketEntity (see tickets.category_id) — a ticket
  // has at most one category, so this behaves like TEAM/SLA_POLICY below
  // (a plain LEFT JOIN), not like TAG's many-to-many fan-out.
  CATEGORY = 'category',
  STATUS = 'status',
  PRIORITY = 'priority',
  TYPE = 'type',
  TAG = 'tag',
  SLA_POLICY = 'sla_policy',
  PERIOD = 'period',
  // Direct 1:1 column on TicketEntity (see TicketChannel) — how the ticket
  // entered the system (портал/почта/Telegram), same plain-column shape as
  // STATUS/PRIORITY/TYPE above, no join needed.
  CHANNEL = 'channel',
}

// Only meaningful when groupBy is PERIOD — the bucket size for date_trunc.
export enum ReportPeriodBucket {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

// Which ticket date column the from/to range filters against.
// CREATED_OR_CLOSED matches a ticket if EITHER its created_at OR closed_at
// falls in range — useful for "what happened in this period" reports that
// shouldn't miss a ticket opened just before the window but closed inside it.
export enum ReportDateField {
  CREATED = 'created',
  CREATED_OR_CLOSED = 'created_or_closed',
  UPDATED = 'updated',
  CLOSED = 'closed',
}

// Stored as jsonb on SavedReportEntity — the report constructor's filter
// set. Every field is optional/absent, meaning "no restriction" on that
// dimension — an absent dateField defaults to CREATED (see
// ReportsRepository.dateColumnsFor's switch default).
export interface ReportFilters {
  // ticket_statuses row ids — not a fixed enum, see PublicTicketStatus.
  statusIds?: string[];
  priorities?: TicketPriority[];
  // ticket_types row ids — not a fixed enum, see PublicTicketType.
  typeIds?: string[];
  teamId?: string;
  assigneeId?: string;
  clientId?: string;
  company?: string;
  tagId?: string;
  categoryId?: string;
  // Both must be set together — a field with no value filter would match
  // every ticket that has ANY row for that field, which isn't a meaningful
  // filter on its own.
  customFieldId?: string;
  customFieldValue?: string;
  dateField?: ReportDateField;
  from?: string;
  to?: string;
  periodBucket?: ReportPeriodBucket;
}
