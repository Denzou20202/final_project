import type { StaffRestrictions } from '@veloxdesk/common';
import { ReportDateField, ReportGroupBy, ReportPeriodBucket } from '@veloxdesk/types';
import type { ReportFilters } from '@veloxdesk/types';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface StatusCount {
  status: string;
  count: number;
}

export interface GroupedReportRow {
  entityId: string | null;
  entityName: string;
  total: number;
  // Keyed by ticket_statuses.id — replaces the old fixed open/pending/
  // resolved/closed fields, which couldn't express an admin-added custom
  // status. One entry per row of the live catalog at query time.
  statusCounts: Record<string, number>;
  avgResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
  slaTotal: number;
  slaCompliant: number;
  weightedKpi: number;
}

export interface TeamLoadRow {
  teamId: string | null;
  teamName: string;
  total: number;
  statusCounts: Record<string, number>;
}

export interface ExportRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  teamName: string;
  assigneeName: string;
  createdAt: Date;
  closedAt: Date | null;
  firstResponseAt: Date | null;
  slaBreached: boolean;
}

// «Экспорт заявок» — one row per ticket (not grouped), for a filtered
// list export. Distinct from ExportRow above, which backs the dashboard's
// fixed-shape CSV (with response/resolution timings) rather than the
// constructor's arbitrary filter set.
export interface TicketListExportRow {
  ticketNumber: number;
  title: string;
  status: string;
  priority: string;
  type: string;
  teamName: string;
  assigneeName: string;
  clientName: string;
  createdAt: Date;
  closedAt: Date | null;
}

// «Отчёт по меткам» — the aggregate breakdown by tag already exists via
// groupedReport(groupBy: 'tag') (see groupSpecFor's TAG case below); this is
// only the drill-down the constructor's exports can't produce: one row per
// (tag, ticket) pair, since a ticket carrying N tags must appear N times.
export interface TagDetailRow {
  tagName: string;
  ticketNumber: number;
  ticketTitle: string;
  status: string;
  teamName: string;
  createdAt: Date;
}

// Normalized shape for «Отчёт по аудиту» regardless of which dimension it's
// grouped by — role is only ever populated for groupBy=actor (a raw
// TicketActivityType has no "role").
export interface AuditSummaryRow {
  key: string | null;
  label: string;
  role: string | null;
  count: number;
}

// «Глобальный аудит настроек» — distinct from AuditSummaryRow above (that
// one aggregates ticket_activities into counts; this is a raw listing of
// settings_audit_log rows, one per change — the point of a settings log is
// seeing WHICH change happened, not just how many).
export interface SettingsAuditLogRow {
  id: string;
  createdAt: Date;
  actorId: string | null;
  actorName: string;
  module: string;
  eventType: string;
  entityId: string | null;
  entityLabel: string;
  changes: Record<string, unknown> | null;
}

export interface CsatQuestionAverageRow {
  questionText: string;
  avgScore: number;
  count: number;
}

export interface CsatOperatorRow {
  assigneeId: string | null;
  assigneeName: string;
  avgScore: number;
  positiveCount: number;
  negativeCount: number;
  totalCount: number;
}

export interface CsatTicketRow {
  ticketId: string;
  ticketNumber: number;
  ticketTitle: string;
  clientName: string;
  assigneeName: string;
  submittedAt: Date;
  avgScore: number;
  answerCount: number;
}

export interface CsatSummaryData {
  overallAvg: number | null;
  totalResponses: number;
  byQuestion: CsatQuestionAverageRow[];
  byOperator: CsatOperatorRow[];
  byTicket: CsatTicketRow[];
}

// «Отчёт по операторам» — time-in-status breakdown, per operator. One row
// per (operator, status name actually used) — the status catalog is
// admin-configurable, so this is never a fixed column set.
export interface OperatorStatusTimeRow {
  userId: string;
  statusName: string;
  minutes: number;
}

// Average time from a client's message to the NEXT staff reply in the same
// ticket, grouped by whichever staff member sent that reply. Deliberately a
// different metric than avgResponseMinutes (ticket creation → first reply,
// see groupedReport) — every comment-thread message the client sends is
// already "mid-conversation" by definition (the ticket's own description
// isn't a comment row), so no first-message exclusion is needed here.
export interface OperatorResponseReturnRow {
  assigneeId: string;
  avgMinutes: number;
  count: number;
}

// First-contact-resolution — resolved/closed and the client never wrote
// again after the operator's first reply. Attributed to whoever sent that
// first reply (not the ticket's current assignee, which can change later).
export interface OperatorFcrRow {
  assigneeId: string;
  resolvedTotal: number;
  fcrCount: number;
}

interface GroupSpec {
  keyExpr: string;
  nameExpr: string;
  fallback: string;
  extraJoin?: string;
  orderBy?: string;
}

// All queries use $1/$2 Postgres placeholders — parameters are never
// string-interpolated into the SQL, so this is safe from injection despite
// being raw SQL (needed here for FILTER/LATERAL, which QueryBuilder can't
// express cleanly).
@Injectable()
export class ReportsRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // $3/$4 (or the last two positional params, in exportRows/teamLoad) encode
  // computeStaffRestrictions (libs/common): NULL means "unrestricted" for
  // that dimension, matching tickets.repository.ts's applyRestrictions —
  // an OPERATOR with restrictToDepartments/restrictToOwnTickets set must see
  // the same slice of tickets in these dashboards as they do in the ticket
  // list itself, not the whole system. ADMIN and unrestricted operators pass
  // both as null.
  private restrictionParams(restrictions: StaffRestrictions): [string[] | null, string | null] {
    return [restrictions.restrictDepartmentIds ?? null, restrictions.restrictToUserId ?? null];
  }

  // The live status catalog, cheapest-possible read (id/name only, display
  // order) — every method below that needs a dynamic per-status column set
  // or a status-id-to-name join calls this once up front. ticket_statuses
  // is never large (a handful of admin-managed rows), so no caching beyond
  // "once per report request" is worth the staleness risk.
  listStatuses(): Promise<{ id: string; name: string }[]> {
    return this.dataSource.query(`SELECT id, name FROM ticket_statuses ORDER BY sort_order`);
  }

  // Builds the `COUNT(*) FILTER (WHERE alias.status_id = '<id>')::int AS
  // "status_<i>"` column list — ids are inlined as literals (not addParam'd)
  // since they come from our own ticket_statuses table, never from request
  // input; a UUID string can never contain a quote, so this is as safe as
  // the file's existing hardcoded enum-literal FILTER clauses elsewhere.
  // Positional "status_<i>" aliases (not the raw uuid, which isn't a valid
  // bare SQL identifier) are mapped back to real ids by extractStatusCounts.
  private statusFilterColumns(statuses: { id: string; name: string }[], alias = 't'): string {
    return statuses
      .map((s, i) => `COUNT(*) FILTER (WHERE ${alias}.status_id = '${s.id}')::int AS "status_${i}"`)
      .join(',\n         ');
  }

  private extractStatusCounts(row: Record<string, unknown>, statuses: { id: string; name: string }[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [i, s] of statuses.entries()) {
      counts[s.id] = Number(row[`status_${i}`] ?? 0);
      delete row[`status_${i}`];
    }
    return counts;
  }

  async statusBreakdown(from: Date, to: Date, restrictions: StaffRestrictions): Promise<StatusCount[]> {
    return this.dataSource.query(
      `SELECT status_id AS status, COUNT(*)::int AS count
       FROM tickets
       WHERE deleted_at IS NULL AND merged_into_id IS NULL AND created_at BETWEEN $1 AND $2
         AND ($3::uuid[] IS NULL OR team_id = ANY($3::uuid[]))
         AND ($4::uuid IS NULL OR assigned_to = $4 OR created_by = $4)
       GROUP BY status_id`,
      [from, to, ...this.restrictionParams(restrictions)],
    );
  }

  async averageResponseMinutes(from: Date, to: Date, restrictions: StaffRestrictions): Promise<number | null> {
    const rows = await this.dataSource.query(
      `WITH first_response AS (
         SELECT c.ticket_id, MIN(c.created_at) AS first_response_at
         FROM comments c
         JOIN tickets t ON t.id = c.ticket_id
         WHERE c.is_internal = false AND c.author_id <> t.created_by
         GROUP BY c.ticket_id
       )
       SELECT AVG(EXTRACT(EPOCH FROM (fr.first_response_at - t.created_at)) / 60) AS avg_min
       FROM tickets t
       JOIN first_response fr ON fr.ticket_id = t.id
       WHERE t.deleted_at IS NULL AND t.merged_into_id IS NULL AND t.created_at BETWEEN $1 AND $2
         AND ($3::uuid[] IS NULL OR t.team_id = ANY($3::uuid[]))
         AND ($4::uuid IS NULL OR t.assigned_to = $4 OR t.created_by = $4)`,
      [from, to, ...this.restrictionParams(restrictions)],
    );
    return this.toNullableNumber(rows[0]?.avg_min);
  }

  async averageResolutionMinutes(from: Date, to: Date, restrictions: StaffRestrictions): Promise<number | null> {
    const rows = await this.dataSource.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (closed_at - created_at)) / 60) AS avg_min
       FROM tickets
       WHERE deleted_at IS NULL AND merged_into_id IS NULL AND closed_at IS NOT NULL AND created_at BETWEEN $1 AND $2
         AND ($3::uuid[] IS NULL OR team_id = ANY($3::uuid[]))
         AND ($4::uuid IS NULL OR assigned_to = $4 OR created_by = $4)`,
      [from, to, ...this.restrictionParams(restrictions)],
    );
    return this.toNullableNumber(rows[0]?.avg_min);
  }

  async slaCompliance(
    from: Date,
    to: Date,
    restrictions: StaffRestrictions,
  ): Promise<{ totalWithSla: number; compliantCount: number }> {
    const rows = await this.dataSource.query(
      `SELECT
         COUNT(*) FILTER (WHERE t.sla_policy_id IS NOT NULL)::int AS total_with_sla,
         COUNT(*) FILTER (
           WHERE t.sla_policy_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM ticket_activities ta
             WHERE ta.ticket_id = t.id AND ta.type IN ('sla_response_breached', 'sla_resolution_breached')
           )
         )::int AS compliant_count
       FROM tickets t
       WHERE t.deleted_at IS NULL AND t.merged_into_id IS NULL AND t.created_at BETWEEN $1 AND $2
         AND ($3::uuid[] IS NULL OR t.team_id = ANY($3::uuid[]))
         AND ($4::uuid IS NULL OR t.assigned_to = $4 OR t.created_by = $4)`,
      [from, to, ...this.restrictionParams(restrictions)],
    );
    return {
      totalWithSla: Number(rows[0]?.total_with_sla ?? 0),
      compliantCount: Number(rows[0]?.compliant_count ?? 0),
    };
  }

  async teamLoad(from: Date, to: Date, restrictions: StaffRestrictions): Promise<TeamLoadRow[]> {
    const statuses = await this.listStatuses();
    const rows = await this.dataSource.query(
      `SELECT
         t.team_id AS "teamId",
         COALESCE(tm.name, 'Без команды') AS "teamName",
         COUNT(*)::int AS total,
         ${this.statusFilterColumns(statuses)}
       FROM tickets t
       LEFT JOIN teams tm ON tm.id = t.team_id
       WHERE t.deleted_at IS NULL AND t.merged_into_id IS NULL AND t.created_at BETWEEN $1 AND $2
         AND ($3::uuid[] IS NULL OR t.team_id = ANY($3::uuid[]))
         AND ($4::uuid IS NULL OR t.assigned_to = $4 OR t.created_by = $4)
       GROUP BY t.team_id, tm.name
       ORDER BY total DESC`,
      [from, to, ...this.restrictionParams(restrictions)],
    );
    return rows.map((row: Record<string, unknown>) => ({
      ...row,
      statusCounts: this.extractStatusCounts(row, statuses),
    })) as TeamLoadRow[];
  }

  async exportRows(from: Date, to: Date, restrictions: StaffRestrictions): Promise<ExportRow[]> {
    return this.dataSource.query(
      `SELECT
         t.id,
         t.title,
         ts.name AS status,
         t.priority,
         COALESCE(tm.name, '') AS "teamName",
         COALESCE(u.full_name, '') AS "assigneeName",
         t.created_at AS "createdAt",
         t.closed_at AS "closedAt",
         fr.first_response_at AS "firstResponseAt",
         EXISTS (
           SELECT 1 FROM ticket_activities ta
           WHERE ta.ticket_id = t.id AND ta.type IN ('sla_response_breached', 'sla_resolution_breached')
         ) AS "slaBreached"
       FROM tickets t
       JOIN ticket_statuses ts ON ts.id = t.status_id
       LEFT JOIN teams tm ON tm.id = t.team_id
       LEFT JOIN users u ON u.id = t.assigned_to
       LEFT JOIN LATERAL (
         SELECT MIN(c.created_at) AS first_response_at
         FROM comments c
         WHERE c.ticket_id = t.id AND c.is_internal = false AND c.author_id <> t.created_by
       ) fr ON true
       WHERE t.deleted_at IS NULL AND t.merged_into_id IS NULL AND t.created_at BETWEEN $1 AND $2
         AND ($3::uuid[] IS NULL OR t.team_id = ANY($3::uuid[]))
         AND ($4::uuid IS NULL OR t.assigned_to = $4 OR t.created_by = $4)
       ORDER BY t.created_at DESC`,
      [from, to, ...this.restrictionParams(restrictions)],
    );
  }

  // Shared by groupedReport and exportTicketRows — every filter value is
  // bound as a $n placeholder pushed onto `params`, never string-
  // interpolated. `addParam` is returned too so a caller can keep adding
  // params (in the same array, correctly numbered) for query pieces built
  // outside this method — e.g. groupedReport's PERIOD bucket literal.
  private buildFilterWhere(filters: ReportFilters, restrictions: StaffRestrictions): {
    where: string;
    params: unknown[];
    addParam: (value: unknown) => string;
  } {
    const params: unknown[] = [];
    const addParam = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };

    // Deleted (trashed) and merged-away tickets must never count here —
    // every other view of ticket counts (sidebar folders, the ticket list)
    // excludes both automatically (soft-delete via TypeORM, merges via
    // tickets.repository.ts's applyRestrictions), but this method talks to
    // `tickets` through raw SQL, which bypasses that entirely.
    const clauses: string[] = ['t.deleted_at IS NULL', 't.merged_into_id IS NULL'];
    // priority is still a native Postgres enum column — comparing an enum
    // directly against a text[] parameter throws "operator does not exist:
    // tickets_priority_enum = text"; casting the COLUMN to text (not the
    // array to the enum type, which would need the exact enum type name
    // hardcoded here) sidesteps that without coupling this query to schema
    // internals. status_id/type_id are plain uuid columns now (ticket_statuses/
    // ticket_types FKs), so they need no such cast.
    if (filters.statusIds?.length) clauses.push(`t.status_id = ANY(${addParam(filters.statusIds)}::uuid[])`);
    if (filters.priorities?.length) clauses.push(`t.priority::text = ANY(${addParam(filters.priorities)}::text[])`);
    if (filters.typeIds?.length) clauses.push(`t.type_id = ANY(${addParam(filters.typeIds)}::uuid[])`);
    if (filters.teamId) clauses.push(`t.team_id = ${addParam(filters.teamId)}`);
    if (filters.assigneeId) clauses.push(`t.assigned_to = ${addParam(filters.assigneeId)}`);
    if (filters.clientId) clauses.push(`t.created_by = ${addParam(filters.clientId)}`);
    if (filters.company) {
      // Subquery, not a direct `uc.company = ...` reference — buildFilterWhere
      // is shared with tagDetailRows/exportTicketRows, which don't all join
      // `users uc` the way groupedReport does, so this can't assume that
      // alias exists in every caller's FROM clause.
      clauses.push(
        `EXISTS (SELECT 1 FROM users cu WHERE cu.id = t.created_by AND cu.company = ${addParam(filters.company)})`,
      );
    }
    if (filters.tagId) {
      clauses.push(
        `EXISTS (SELECT 1 FROM ticket_tags tt WHERE tt.ticket_id = t.id AND tt.tag_id = ${addParam(filters.tagId)})`,
      );
    }
    if (filters.categoryId) clauses.push(`t.category_id = ${addParam(filters.categoryId)}`);
    if (filters.customFieldId && filters.customFieldValue !== undefined) {
      clauses.push(
        `EXISTS (SELECT 1 FROM ticket_custom_field_values cfv WHERE cfv.ticket_id = t.id AND cfv.field_id = ${addParam(filters.customFieldId)} AND cfv.value = ${addParam(filters.customFieldValue)})`,
      );
    }

    // Same StaffRestrictions a department/own-tickets-restricted actor gets
    // everywhere else (tickets.repository.ts's applyRestrictions, this file's
    // own restrictionParams for the dashboard queries above) — without this,
    // a restricted ADMIN (see UserEntity.cannotManageAdmins /
    // restrictToDepartments) could see org-wide data through the report
    // constructor despite being scoped everywhere else.
    if (restrictions.restrictDepartmentIds) {
      clauses.push(`t.team_id = ANY(${addParam(restrictions.restrictDepartmentIds)}::uuid[])`);
    }
    if (restrictions.restrictToUserId) {
      const p = addParam(restrictions.restrictToUserId);
      clauses.push(`(t.assigned_to = ${p} OR t.created_by = ${p})`);
    }

    // Built as ONE combined predicate, not two independently-ANDed from/to
    // clauses — for CREATED_OR_CLOSED that distinction matters: a ticket
    // opened long before `from` and still open past `to` must NOT match
    // just because *some* column clears each bound on its own.
    const dateColumns = this.dateColumnsFor(filters.dateField);
    const fromParam = filters.from ? addParam(new Date(filters.from)) : null;
    const toParam = filters.to ? addParam(new Date(filters.to)) : null;
    if (fromParam || toParam) {
      const perColumn = dateColumns.map((col) => {
        if (fromParam && toParam) return `(${col} BETWEEN ${fromParam} AND ${toParam})`;
        return fromParam ? `${col} >= ${fromParam}` : `${col} <= ${toParam}`;
      });
      clauses.push(dateColumns.length > 1 ? `(${perColumn.join(' OR ')})` : perColumn[0]);
    }

    return { where: clauses.length ? clauses.join(' AND ') : 'TRUE', params, addParam };
  }

  // The report constructor's core query — one row per <groupBy dimension
  // value>, filtered by whichever of statuses/priorities/types/team/
  // assignee/client/tag/date-range the caller set. Only the SQL *shape*
  // (which columns to group/filter by) branches on the (enum-validated)
  // groupBy/dateField, not on raw filter values.
  async groupedReport(groupBy: ReportGroupBy, filters: ReportFilters, restrictions: StaffRestrictions): Promise<GroupedReportRow[]> {
    const statuses = await this.listStatuses();
    const { where, params, addParam } = this.buildFilterWhere(filters, restrictions);
    const primaryDateColumn = this.dateColumnsFor(filters.dateField)[0];
    const { keyExpr, nameExpr, fallback, extraJoin, orderBy } = this.groupSpecFor(
      groupBy,
      filters.periodBucket,
      primaryDateColumn,
      addParam,
    );

    const rows = await this.dataSource.query(
      `SELECT
         ${keyExpr} AS "entityId",
         COALESCE(${nameExpr}, '${fallback}') AS "entityName",
         COUNT(*)::int AS total,
         ${this.statusFilterColumns(statuses)},
         AVG(EXTRACT(EPOCH FROM (fr.first_response_at - t.created_at)) / 60) AS "avgResponseMinutes",
         AVG(EXTRACT(EPOCH FROM (t.closed_at - t.created_at)) / 60)
           FILTER (WHERE t.closed_at IS NOT NULL) AS "avgResolutionMinutes",
         COUNT(*) FILTER (WHERE t.sla_policy_id IS NOT NULL)::int AS "slaTotal",
         COUNT(*) FILTER (
           WHERE t.sla_policy_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM ticket_activities ta
             WHERE ta.ticket_id = t.id AND ta.type IN ('sla_response_breached', 'sla_resolution_breached')
           )
         )::int AS "slaCompliant",
         -- KPI as a weighted sum by ticket type — admin-configurable per
         -- row on ticket_types (see TicketTypeEntity.weight); a type with no
         -- row (shouldn't happen, type_id is NOT NULL) counts as weight 1,
         -- same as the entity's own column default.
         SUM(COALESCE(wt.weight, 1))::numeric AS "weightedKpi"
       FROM tickets t
       JOIN ticket_statuses ts ON ts.id = t.status_id
       LEFT JOIN LATERAL (
         SELECT MIN(c.created_at) AS first_response_at
         FROM comments c
         WHERE c.ticket_id = t.id AND c.is_internal = false AND c.author_id <> t.created_by
       ) fr ON true
       LEFT JOIN users ua ON ua.id = t.assigned_to
       LEFT JOIN users uc ON uc.id = t.created_by
       LEFT JOIN teams tm ON tm.id = t.team_id
       -- Always joined regardless of groupBy (same as ts above) — distinct
       -- alias from groupSpecFor's TYPE-case extraJoin (rtype) below, since
       -- both can be present in the same query.
       LEFT JOIN ticket_types wt ON wt.id = t.type_id
       ${extraJoin ?? ''}
       WHERE ${where}
       GROUP BY ${keyExpr}, ${nameExpr}
       ORDER BY ${orderBy ?? 'total DESC'}`,
      params,
    );
    return rows.map((row: Record<string, unknown>) => ({
      ...row,
      statusCounts: this.extractStatusCounts(row, statuses),
    })) as GroupedReportRow[];
  }

  // «Экспорт заявок» — the same filter set as groupedReport, but one row
  // per ticket instead of aggregated groups.
  async exportTicketRows(filters: ReportFilters, restrictions: StaffRestrictions): Promise<TicketListExportRow[]> {
    const { where, params } = this.buildFilterWhere(filters, restrictions);
    return this.dataSource.query(
      `SELECT
         t.ticket_number AS "ticketNumber",
         t.title,
         ts.name AS status,
         t.priority::text AS priority,
         tty.name AS type,
         COALESCE(tm.name, '') AS "teamName",
         COALESCE(ua.full_name, '') AS "assigneeName",
         COALESCE(uc.full_name, '') AS "clientName",
         t.created_at AS "createdAt",
         t.closed_at AS "closedAt"
       FROM tickets t
       JOIN ticket_statuses ts ON ts.id = t.status_id
       JOIN ticket_types tty ON tty.id = t.type_id
       LEFT JOIN teams tm ON tm.id = t.team_id
       LEFT JOIN users ua ON ua.id = t.assigned_to
       LEFT JOIN users uc ON uc.id = t.created_by
       WHERE ${where}
       ORDER BY t.created_at DESC`,
      params,
    );
  }

  // «Отчёт по меткам» — детализация: same filter set as exportTicketRows,
  // but INNER JOIN ticket_tags/tags instead of just tickets, so a ticket
  // carrying N tags contributes N rows (one per tag) rather than one. If the
  // caller also set filters.tagId, buildFilterWhere's EXISTS clause already
  // narrows to that one tag — this join then just re-confirms/fans out the
  // (at most one) matching pair, which is harmless.
  async tagDetailRows(filters: ReportFilters, restrictions: StaffRestrictions): Promise<TagDetailRow[]> {
    const { where, params } = this.buildFilterWhere(filters, restrictions);
    return this.dataSource.query(
      `SELECT
         tag.name AS "tagName",
         t.ticket_number AS "ticketNumber",
         t.title AS "ticketTitle",
         ts.name AS status,
         COALESCE(tm.name, '') AS "teamName",
         t.created_at AS "createdAt"
       FROM ticket_tags tt
       JOIN tags tag ON tag.id = tt.tag_id
       JOIN tickets t ON t.id = tt.ticket_id
       JOIN ticket_statuses ts ON ts.id = t.status_id
       LEFT JOIN teams tm ON tm.id = t.team_id
       WHERE ${where}
       ORDER BY tag.name ASC, t.ticket_number ASC`,
      params,
    );
  }

  // «Отчёт по аудиту» — aggregates ticket_activities (not tickets), so it
  // doesn't share buildFilterWhere/groupSpecFor at all; a plain date-range
  // over the activity log itself, grouped by activity type or by actor.
  // ticket_activities.ticket_id is NOT NULL, so the join to restrict by the
  // owning ticket's team/assignee/creator (see buildFilterWhere's restriction
  // clauses) never drops an activity that should have counted.
  async auditActivitySummary(
    groupBy: 'type' | 'actor',
    from: Date,
    to: Date,
    restrictions: StaffRestrictions,
  ): Promise<AuditSummaryRow[]> {
    const params: unknown[] = [from, to];
    const restrictionClauses: string[] = [];
    if (restrictions.restrictDepartmentIds) {
      restrictionClauses.push(`t.team_id = ANY($${params.push(restrictions.restrictDepartmentIds)}::uuid[])`);
    }
    if (restrictions.restrictToUserId) {
      params.push(restrictions.restrictToUserId);
      const p = `$${params.length}`;
      restrictionClauses.push(`(t.assigned_to = ${p} OR t.created_by = ${p})`);
    }
    const restrictionWhere = restrictionClauses.length ? ` AND ${restrictionClauses.join(' AND ')}` : '';

    if (groupBy === 'actor') {
      return this.dataSource.query(
        `SELECT
           ta.actor_id::text AS key,
           COALESCE(u.full_name, 'Система') AS label,
           u.role::text AS role,
           COUNT(*)::int AS count
         FROM ticket_activities ta
         JOIN tickets t ON t.id = ta.ticket_id
         LEFT JOIN users u ON u.id = ta.actor_id
         WHERE ta.created_at BETWEEN $1 AND $2${restrictionWhere}
         GROUP BY ta.actor_id, u.full_name, u.role
         ORDER BY count DESC`,
        params,
      );
    }
    return this.dataSource.query(
      `SELECT
         ta.type::text AS key,
         ta.type::text AS label,
         NULL::text AS role,
         COUNT(*)::int AS count
       FROM ticket_activities ta
       JOIN tickets t ON t.id = ta.ticket_id
       WHERE ta.created_at BETWEEN $1 AND $2${restrictionWhere}
       GROUP BY ta.type
       ORDER BY count DESC`,
      params,
    );
  }

  // «Глобальный аудит настроек» — raw listing (not aggregated), newest
  // first, capped at 500 rows so an unfiltered wide date range can't return
  // an unbounded result — the UI is meant to be narrowed with the filters,
  // not scrolled through as a full history dump.
  async settingsAuditLog(filters: {
    from: Date;
    to: Date;
    actorId?: string;
    module?: string;
    eventType?: string;
  }): Promise<SettingsAuditLogRow[]> {
    const params: unknown[] = [filters.from, filters.to];
    const clauses = ['sal.created_at BETWEEN $1 AND $2'];
    if (filters.actorId) clauses.push(`sal.actor_id = $${params.push(filters.actorId)}`);
    if (filters.module) clauses.push(`sal.module::text = $${params.push(filters.module)}`);
    if (filters.eventType) clauses.push(`sal.event_type::text = $${params.push(filters.eventType)}`);

    return this.dataSource.query(
      `SELECT
         sal.id,
         sal.created_at AS "createdAt",
         sal.actor_id AS "actorId",
         COALESCE(u.full_name, 'Система') AS "actorName",
         sal.module::text AS module,
         sal.event_type::text AS "eventType",
         sal.entity_id AS "entityId",
         sal.entity_label AS "entityLabel",
         sal.changes AS changes
       FROM settings_audit_log sal
       LEFT JOIN users u ON u.id = sal.actor_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY sal.created_at DESC
       LIMIT 500`,
      params,
    );
  }

  // «Оценка удовлетворённости (CSAT)» — aggregates csat_answers, joined to
  // tickets only for the team/assignee filters (ticket_id is denormalized
  // directly on csat_answers, same reasoning as ticket_activities).
  async csatSummary(
    filters: {
      teamId?: string;
      assigneeId?: string;
      from?: Date;
      to?: Date;
    },
    restrictions: StaffRestrictions,
  ): Promise<CsatSummaryData> {
    const params: unknown[] = [];
    const addParam = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };
    // Same mandatory exclusion as buildFilterWhere above — raw SQL against
    // `tickets` bypasses TypeORM's automatic soft-delete filter, and a
    // merged-away ticket isn't soft-deleted either (merge() just closes it
    // and sets merged_into_id), so both must be excluded explicitly here too.
    const clauses: string[] = ['t.deleted_at IS NULL', 't.merged_into_id IS NULL'];
    if (filters.teamId) clauses.push(`t.team_id = ${addParam(filters.teamId)}`);
    if (filters.assigneeId) clauses.push(`t.assigned_to = ${addParam(filters.assigneeId)}`);
    if (filters.from) clauses.push(`ca.created_at >= ${addParam(filters.from)}`);
    if (filters.to) clauses.push(`ca.created_at <= ${addParam(filters.to)}`);
    if (restrictions.restrictDepartmentIds) {
      clauses.push(`t.team_id = ANY(${addParam(restrictions.restrictDepartmentIds)}::uuid[])`);
    }
    if (restrictions.restrictToUserId) {
      const p = addParam(restrictions.restrictToUserId);
      clauses.push(`(t.assigned_to = ${p} OR t.created_by = ${p})`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const [byQuestion, byOperator, overall, byTicket]: [
      { questionText: string; avgScore: string; count: number }[],
      { assigneeId: string | null; assigneeName: string; avgScore: string; positiveCount: number; negativeCount: number; totalCount: number }[],
      { avgScore: string | null; count: number }[],
      {
        ticketId: string;
        ticketNumber: number;
        ticketTitle: string;
        clientName: string;
        assigneeName: string;
        submittedAt: Date;
        avgScore: string;
        answerCount: number;
      }[],
    ] = await Promise.all([
      this.dataSource.query(
        `SELECT ca.question_text AS "questionText", AVG(ca.score) AS "avgScore", COUNT(*)::int AS count
         FROM csat_answers ca
         JOIN tickets t ON t.id = ca.ticket_id
         ${where}
         GROUP BY ca.question_text
         ORDER BY MIN(ca.created_at) ASC`,
        params,
      ),
      this.dataSource.query(
        `SELECT
           t.assigned_to AS "assigneeId",
           COALESCE(u.full_name, 'Не назначен') AS "assigneeName",
           AVG(ca.score) AS "avgScore",
           COUNT(*) FILTER (WHERE ca.score >= 4)::int AS "positiveCount",
           COUNT(*) FILTER (WHERE ca.score <= 2)::int AS "negativeCount",
           COUNT(*)::int AS "totalCount"
         FROM csat_answers ca
         JOIN tickets t ON t.id = ca.ticket_id
         LEFT JOIN users u ON u.id = t.assigned_to
         ${where}
         GROUP BY t.assigned_to, u.full_name
         ORDER BY "avgScore" DESC`,
        params,
      ),
      this.dataSource.query(
        `SELECT AVG(ca.score) AS "avgScore", COUNT(*)::int AS count
         FROM csat_answers ca
         JOIN tickets t ON t.id = ca.ticket_id
         ${where}`,
        params,
      ),
      // One row per rated ticket — the "who and which ticket" drill-down
      // behind the aggregate averages above. csat_surveys is joined only for
      // its submitted_at (the moment the client actually rated, as opposed
      // to ca.created_at which would work identically here since every
      // answer for a survey is inserted in the same request, but this is the
      // semantically correct column to read it from).
      this.dataSource.query(
        `SELECT
           t.id AS "ticketId",
           t.ticket_number AS "ticketNumber",
           t.title AS "ticketTitle",
           COALESCE(uc.full_name, '') AS "clientName",
           COALESCE(ua.full_name, '') AS "assigneeName",
           s.submitted_at AS "submittedAt",
           AVG(ca.score) AS "avgScore",
           COUNT(*)::int AS "answerCount"
         FROM csat_answers ca
         JOIN csat_surveys s ON s.id = ca.survey_id
         JOIN tickets t ON t.id = ca.ticket_id
         LEFT JOIN users uc ON uc.id = t.created_by
         LEFT JOIN users ua ON ua.id = t.assigned_to
         ${where}
         GROUP BY t.id, t.ticket_number, t.title, uc.full_name, ua.full_name, s.submitted_at
         ORDER BY s.submitted_at DESC`,
        params,
      ),
    ]);

    return {
      overallAvg: this.toNullableNumber(overall[0]?.avgScore),
      totalResponses: Number(overall[0]?.count ?? 0),
      byQuestion: byQuestion.map((row) => ({
        questionText: row.questionText,
        avgScore: Number(row.avgScore),
        count: row.count,
      })),
      byOperator: byOperator.map((row) => ({
        assigneeId: row.assigneeId,
        assigneeName: row.assigneeName,
        avgScore: Number(row.avgScore),
        positiveCount: row.positiveCount,
        negativeCount: row.negativeCount,
        totalCount: row.totalCount,
      })),
      byTicket: byTicket.map((row) => ({
        ticketId: row.ticketId,
        ticketNumber: row.ticketNumber,
        ticketTitle: row.ticketTitle,
        clientName: row.clientName,
        assigneeName: row.assigneeName,
        submittedAt: row.submittedAt,
        avgScore: Number(row.avgScore),
        answerCount: row.answerCount,
      })),
    };
  }

  // «Отчёт по операторам» — time spent in each status, restricted to the
  // operator ids already returned by groupedReport(ASSIGNEE, ...) (that call
  // already applied the team filter at the ticket level) rather than
  // re-deriving "operators on this team" via team_members here.
  async operatorStatusTime(from: Date, to: Date, userIds: string[]): Promise<OperatorStatusTimeRow[]> {
    if (userIds.length === 0) return [];
    return this.dataSource.query(
      `WITH bounded AS (
         SELECT
           h.user_id,
           h.status_name,
           h.created_at,
           LEAD(h.created_at) OVER (PARTITION BY h.user_id ORDER BY h.created_at) AS next_at
         FROM employee_status_history h
         WHERE h.user_id = ANY($3::uuid[]) AND h.created_at <= $2
       ),
       clipped AS (
         SELECT
           user_id,
           status_name,
           GREATEST(created_at, $1::timestamptz) AS seg_start,
           LEAST(COALESCE(next_at, $2::timestamptz), $2::timestamptz) AS seg_end
         FROM bounded
         WHERE COALESCE(next_at, $2::timestamptz) > $1::timestamptz
       )
       SELECT user_id AS "userId", status_name AS "statusName",
         SUM(EXTRACT(EPOCH FROM (seg_end - seg_start)) / 60)::numeric AS minutes
       FROM clipped
       WHERE seg_end > seg_start
       GROUP BY user_id, status_name
       ORDER BY user_id, minutes DESC`,
      [from, to, userIds],
    );
  }

  // «Скорость возврата в диалог» — for every client message (a comments row,
  // not the ticket's own description field — so already mid-conversation by
  // definition), the time to the next staff reply, grouped by whichever
  // staff member sent it.
  async operatorResponseReturnSpeed(
    from: Date,
    to: Date,
    teamId: string | undefined,
    restrictions: StaffRestrictions,
  ): Promise<OperatorResponseReturnRow[]> {
    const params: unknown[] = [from, to];
    const teamClause = teamId ? `AND t.team_id = $${params.push(teamId)}` : '';
    const restrictionClause = this.staffRestrictionClause(params, restrictions);
    return this.dataSource.query(
      `WITH msgs AS (
         SELECT c.id, c.ticket_id, c.created_at, c.author_id, (c.author_id = t.created_by) AS is_client
         FROM comments c
         JOIN tickets t ON t.id = c.ticket_id
         WHERE c.is_internal = false AND t.deleted_at IS NULL AND t.merged_into_id IS NULL
           AND t.created_at BETWEEN $1 AND $2 ${teamClause}${restrictionClause}
       ),
       client_msgs AS (
         SELECT id, ticket_id, created_at FROM msgs WHERE is_client = true
       ),
       next_staff AS (
         SELECT
           cm.id AS client_comment_id,
           cm.created_at AS client_at,
           m2.created_at AS staff_at,
           m2.author_id AS staff_id,
           ROW_NUMBER() OVER (PARTITION BY cm.id ORDER BY m2.created_at) AS rn
         FROM client_msgs cm
         JOIN msgs m2 ON m2.ticket_id = cm.ticket_id AND m2.is_client = false AND m2.created_at > cm.created_at
       )
       SELECT staff_id AS "assigneeId",
         AVG(EXTRACT(EPOCH FROM (staff_at - client_at)) / 60) AS "avgMinutes",
         COUNT(*)::int AS count
       FROM next_staff
       WHERE rn = 1
       GROUP BY staff_id`,
      params,
    );
  }

  // «% решений с первого ответа» — ticket reached a resolution point
  // (ts.is_closed OR NOT ts.tracks_sla — equivalent to the old hardcoded
  // status IN ('resolved','closed') for the 4 seeded statuses, generalized
  // to admin-created ones: an admin turning off tracksSla on a custom
  // status also opts it into counting as "resolved" here, a side effect
  // worth calling out in that flag's own admin-UI tooltip) and the client
  // never wrote again after the operator's first reply. Attributed to
  // whoever sent that first reply, which may not be the ticket's current
  // assignee. first_replier below uses ROW_NUMBER, not a plain equality join — two
  // staff comments on the same ticket sharing the exact same created_at
  // (bulk-imported/seeded data, or any insert path timestamping several rows
  // off one NOW()) would otherwise both match c.created_at = fsr.first_reply_at,
  // duplicating that ticket's resolution across two operators' FCR%. Same
  // fix shape operatorResponseReturnSpeed above already uses for an
  // analogous "exactly one first match" requirement.
  async operatorFcr(
    from: Date,
    to: Date,
    teamId: string | undefined,
    restrictions: StaffRestrictions,
  ): Promise<OperatorFcrRow[]> {
    const params: unknown[] = [from, to];
    const teamClause = teamId ? `AND t.team_id = $${params.push(teamId)}` : '';
    const restrictionClause = this.staffRestrictionClause(params, restrictions);
    return this.dataSource.query(
      `WITH first_staff_reply AS (
         SELECT c.ticket_id, MIN(c.created_at) AS first_reply_at
         FROM comments c
         JOIN tickets t ON t.id = c.ticket_id
         WHERE c.is_internal = false AND c.author_id <> t.created_by
         GROUP BY c.ticket_id
       ),
       first_replier AS (
         SELECT ticket_id, first_reply_at, replier_id FROM (
           SELECT
             fsr.ticket_id,
             fsr.first_reply_at,
             c.author_id AS replier_id,
             ROW_NUMBER() OVER (PARTITION BY fsr.ticket_id ORDER BY c.id) AS rn
           FROM first_staff_reply fsr
           JOIN comments c ON c.ticket_id = fsr.ticket_id AND c.created_at = fsr.first_reply_at AND c.is_internal = false
         ) ranked
         WHERE rn = 1
       ),
       client_followup_after AS (
         SELECT DISTINCT c.ticket_id
         FROM comments c
         JOIN tickets t ON t.id = c.ticket_id
         JOIN first_staff_reply fsr ON fsr.ticket_id = c.ticket_id
         WHERE c.is_internal = false AND c.author_id = t.created_by AND c.created_at > fsr.first_reply_at
       )
       SELECT
         fr.replier_id AS "assigneeId",
         COUNT(*) FILTER (WHERE ts.is_closed OR NOT ts.tracks_sla)::int AS "resolvedTotal",
         COUNT(*) FILTER (WHERE (ts.is_closed OR NOT ts.tracks_sla) AND cfa.ticket_id IS NULL)::int AS "fcrCount"
       FROM first_replier fr
       JOIN tickets t ON t.id = fr.ticket_id
       JOIN ticket_statuses ts ON ts.id = t.status_id
       LEFT JOIN client_followup_after cfa ON cfa.ticket_id = fr.ticket_id
       WHERE t.deleted_at IS NULL AND t.merged_into_id IS NULL AND t.created_at BETWEEN $1 AND $2 ${teamClause}${restrictionClause}
       GROUP BY fr.replier_id`,
      params,
    );
  }

  // Shared by operatorResponseReturnSpeed/operatorFcr — both build their own
  // positional params array (teamClause pushes onto it first), so this
  // appends to that same array/numbering rather than returning a fresh one,
  // same shape as buildFilterWhere's addParam.
  private staffRestrictionClause(params: unknown[], restrictions: StaffRestrictions): string {
    const clauses: string[] = [];
    if (restrictions.restrictDepartmentIds) {
      clauses.push(`t.team_id = ANY($${params.push(restrictions.restrictDepartmentIds)}::uuid[])`);
    }
    if (restrictions.restrictToUserId) {
      params.push(restrictions.restrictToUserId);
      const p = `$${params.length}`;
      clauses.push(`(t.assigned_to = ${p} OR t.created_by = ${p})`);
    }
    return clauses.length ? ` AND ${clauses.join(' AND ')}` : '';
  }

  private dateColumnsFor(field: ReportDateField | undefined): string[] {
    switch (field) {
      case ReportDateField.CLOSED:
        return ['t.closed_at'];
      case ReportDateField.UPDATED:
        return ['t.updated_at'];
      case ReportDateField.CREATED_OR_CLOSED:
        return ['t.created_at', 't.closed_at'];
      case ReportDateField.CREATED:
      default:
        return ['t.created_at'];
    }
  }

  private groupSpecFor(
    groupBy: ReportGroupBy,
    periodBucket: ReportPeriodBucket | undefined,
    primaryDateColumn: string,
    addParam: (value: unknown) => string,
  ): GroupSpec {
    switch (groupBy) {
      case ReportGroupBy.CLIENT:
        return { keyExpr: 't.created_by', nameExpr: 'uc.full_name', fallback: 'Неизвестно' };
      case ReportGroupBy.COMPANY:
        // `uc` (users, created_by) is already joined unconditionally in
        // groupedReport's main query below — no extraJoin needed.
        return { keyExpr: 'uc.company', nameExpr: 'uc.company', fallback: 'Без компании' };
      case ReportGroupBy.TEAM:
        return { keyExpr: 't.team_id', nameExpr: 'tm.name', fallback: 'Без отдела' };
      case ReportGroupBy.STATUS:
        // groupedReport's main query unconditionally joins `ticket_statuses
        // ts` (added alongside the dynamic statusFilterColumns above) — see
        // extraJoin note: no extraJoin needed here since that join already
        // exists in every groupedReport call regardless of groupBy.
        return { keyExpr: 't.status_id', nameExpr: 'ts.name', fallback: 'Неизвестно' };
      case ReportGroupBy.PRIORITY:
        return { keyExpr: 't.priority::text', nameExpr: 't.priority::text', fallback: 'Неизвестно' };
      case ReportGroupBy.TYPE:
        // groupedReport's main query unconditionally joins `ticket_types wt`
        // (added alongside the weightedKpi column above) under a different
        // alias — this needs its own join since `wt` is meant for the
        // weight lookup, not display, and reusing it here would mean two
        // different GROUP BY expressions (weight vs. name) racing over one
        // alias if a future column ever needed both.
        return {
          keyExpr: 't.type_id',
          nameExpr: 'rtype.name',
          fallback: 'Неизвестно',
          extraJoin: 'LEFT JOIN ticket_types rtype ON rtype.id = t.type_id',
        };
      case ReportGroupBy.CHANNEL:
        // Unlike STATUS/PRIORITY/TYPE above, the raw value isn't shown
        // as-is — 'portal'/'email'/'telegram' get mapped to the same
        // Russian labels TicketActionsPanel's «Создано из» row uses, since
        // there's no generic entityName translation layer downstream (see
        // reports.service.ts's toPublicRow — it passes entityName through
        // verbatim).
        return {
          keyExpr: 't.channel::text',
          nameExpr: `CASE t.channel::text
            WHEN 'portal' THEN 'Веб-приложение'
            WHEN 'email' THEN 'Email'
            WHEN 'telegram' THEN 'Telegram'
          END`,
          fallback: 'Неизвестно',
        };
      case ReportGroupBy.TAG:
        // LEFT JOIN (not INNER) so untagged tickets still show up under the
        // fallback group, same as an unassigned ticket does for ASSIGNEE —
        // and since a ticket can carry several tags, it legitimately
        // contributes to more than one group's counts here (row
        // multiplication through the join), unlike every other dimension.
        return {
          keyExpr: 'rtag.id',
          nameExpr: 'rtag.name',
          fallback: 'Без меток',
          extraJoin: 'LEFT JOIN ticket_tags rtt ON rtt.ticket_id = t.id LEFT JOIN tags rtag ON rtag.id = rtt.tag_id',
        };
      case ReportGroupBy.SLA_POLICY:
        return {
          keyExpr: 't.sla_policy_id',
          nameExpr: 'sp.name',
          fallback: 'Без SLA-политики',
          extraJoin: 'LEFT JOIN sla_policies sp ON sp.id = t.sla_policy_id',
        };
      case ReportGroupBy.CATEGORY:
        return {
          keyExpr: 't.category_id',
          nameExpr: 'rcat.name',
          fallback: 'Без категории',
          extraJoin: 'LEFT JOIN ticket_categories rcat ON rcat.id = t.category_id',
        };
      case ReportGroupBy.PERIOD: {
        // Buckets the SAME date column the from/to filter already uses
        // (dateColumnsFor's first entry — CREATED_OR_CLOSED's second column
        // is ignored here, a trend axis needs one definite date, not an OR
        // of two). Rows are meaningless sorted by volume, so this is the
        // one dimension with a non-default ORDER BY.
        const bucketParam = addParam(periodBucket ?? 'day');
        const truncExpr = `date_trunc(${bucketParam}, ${primaryDateColumn})`;
        const dayExpr = `to_char(${truncExpr}, 'YYYY-MM-DD')`;
        return { keyExpr: dayExpr, nameExpr: dayExpr, fallback: '—', orderBy: `${dayExpr} ASC` };
      }
      case ReportGroupBy.ASSIGNEE:
      default:
        return { keyExpr: 't.assigned_to', nameExpr: 'ua.full_name', fallback: 'Не назначен' };
    }
  }

  private toNullableNumber(value: unknown): number | null {
    return value === null || value === undefined ? null : Number(value);
  }
}
