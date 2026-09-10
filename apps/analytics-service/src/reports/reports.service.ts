import { computeStaffRestrictions, JwtPayload } from '@veloxdesk/common';
import { ReportDateField, ReportGroupBy } from '@veloxdesk/types';
import { Injectable, NotFoundException } from '@nestjs/common';
import { toCsv } from './csv.js';
import { toXml } from './xml.js';
import { AuditReportQueryDto } from './dto/audit-report-query.dto.js';
import { CreateSavedReportDto } from './dto/create-saved-report.dto.js';
import { CsatReportQueryDto } from './dto/csat-report-query.dto.js';
import { OperatorReportQueryDto } from './dto/operator-report-query.dto.js';
import { ReportPeriodQueryDto } from './dto/report-period-query.dto.js';
import { RunReportDto } from './dto/run-report.dto.js';
import { SettingsAuditQueryDto } from './dto/settings-audit-query.dto.js';
import { UpdateSavedReportDto } from './dto/update-saved-report.dto.js';
import { ReportFiltersDto } from './dto/report-filters.dto.js';
import { CsatSummaryData, GroupedReportRow, ReportsRepository } from './reports.repository.js';
import { PublicSavedReport, toPublicSavedReport } from './saved-report.public.js';
import { SavedReportData, SavedReportsRepository } from './saved-reports.repository.js';

const DEFAULT_PERIOD_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const GROUP_LABELS: Record<ReportGroupBy, string> = {
  [ReportGroupBy.ASSIGNEE]: 'Оператор',
  [ReportGroupBy.CLIENT]: 'Клиент',
  [ReportGroupBy.COMPANY]: 'Компания',
  [ReportGroupBy.TEAM]: 'Отдел',
  [ReportGroupBy.CATEGORY]: 'Категория',
  [ReportGroupBy.STATUS]: 'Статус',
  [ReportGroupBy.PRIORITY]: 'Приоритет',
  [ReportGroupBy.TYPE]: 'Тип заявки',
  [ReportGroupBy.TAG]: 'Метка',
  [ReportGroupBy.SLA_POLICY]: 'SLA-политика',
  [ReportGroupBy.PERIOD]: 'Период',
  [ReportGroupBy.CHANNEL]: 'Канал',
};

export interface PublicGroupedReportRow {
  entityId: string | null;
  entityName: string;
  total: number;
  // Keyed by ticket_statuses.id — see GroupedReportRow's own comment.
  statusCounts: Record<string, number>;
  avgResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
  slaComplianceRate: number | null;
  weightedKpi: number;
}

export interface PublicGroupedReport {
  groupBy: ReportGroupBy;
  groupLabel: string;
  rows: PublicGroupedReportRow[];
}

// Shared by the CSV and XML exporters — one definition per column, keyed the
// same way the frontend's ColumnKey/COLUMN_KEYS are, so a column hidden on
// screen (and thus absent from `columns`) is skipped in both export formats
// identically instead of each hardcoding its own field list. No longer a
// closed union/module-level constant — the per-status columns depend on the
// live ticket_statuses catalog, so both the key list and the defs are built
// per request by buildColumnDefs() below.
type ReportColumnKey = string;
type ReportColumnDef = { header: string; value: (row: PublicGroupedReportRow) => string | number };

function statusColumnKey(statusId: string): string {
  return `status_${statusId}`;
}

export interface PublicOperatorStatusTime {
  statusName: string;
  minutes: number;
}

export interface PublicOperatorRow {
  assigneeId: string | null;
  assigneeName: string;
  total: number;
  statusCounts: Record<string, number>;
  avgResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
  slaComplianceRate: number | null;
  weightedKpi: number;
  // Empty for the "Не назначен" pseudo-row and for any real operator with no
  // logged status history in the period — not every operator necessarily
  // changed status at all during a short window.
  statusTime: PublicOperatorStatusTime[];
  responseReturnMinutes: number | null;
  fcrRate: number | null;
}

export interface PublicOperatorReport {
  from: string;
  to: string;
  rows: PublicOperatorRow[];
}

export interface DashboardReport {
  from: string;
  to: string;
  totalTickets: number;
  statusBreakdown: Record<string, number>;
  avgResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
  slaComplianceRate: number | null;
}

export interface TeamLoadReport {
  from: string;
  to: string;
  teams: {
    teamId: string | null;
    teamName: string;
    total: number;
    statusCounts: Record<string, number>;
  }[];
}

export interface PublicAuditSummaryRow {
  key: string | null;
  label: string;
  role: string | null;
  count: number;
}

export interface PublicSettingsAuditLogRow {
  id: string;
  createdAt: string;
  actorId: string | null;
  actorName: string;
  module: string;
  eventType: string;
  entityId: string | null;
  entityLabel: string;
  changes: Record<string, unknown> | null;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly reportsRepository: ReportsRepository,
    private readonly savedReportsRepository: SavedReportsRepository,
  ) {}

  async getDashboard(query: ReportPeriodQueryDto, actor: JwtPayload): Promise<DashboardReport> {
    const { from, to } = this.resolvePeriod(query);
    const restrictions = computeStaffRestrictions(actor);

    const [statusRows, avgResponseMinutes, avgResolutionMinutes, sla] = await Promise.all([
      this.reportsRepository.statusBreakdown(from, to, restrictions),
      this.reportsRepository.averageResponseMinutes(from, to, restrictions),
      this.reportsRepository.averageResolutionMinutes(from, to, restrictions),
      this.reportsRepository.slaCompliance(from, to, restrictions),
    ]);

    const statusBreakdown = Object.fromEntries(statusRows.map((row) => [row.status, row.count]));
    const totalTickets = statusRows.reduce((sum, row) => sum + row.count, 0);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      totalTickets,
      statusBreakdown,
      avgResponseMinutes: this.round(avgResponseMinutes),
      avgResolutionMinutes: this.round(avgResolutionMinutes),
      slaComplianceRate: sla.totalWithSla === 0 ? null : this.round((sla.compliantCount / sla.totalWithSla) * 100),
    };
  }

  async getTeamLoad(query: ReportPeriodQueryDto, actor: JwtPayload): Promise<TeamLoadReport> {
    const { from, to } = this.resolvePeriod(query);
    const teams = await this.reportsRepository.teamLoad(from, to, computeStaffRestrictions(actor));
    return { from: from.toISOString(), to: to.toISOString(), teams };
  }

  async exportCsv(query: ReportPeriodQueryDto, actor: JwtPayload): Promise<string> {
    const { from, to } = this.resolvePeriod(query);
    const rows = await this.reportsRepository.exportRows(from, to, computeStaffRestrictions(actor));

    const headers = [
      'id',
      'title',
      'status',
      'priority',
      'team',
      'assignee',
      'created_at',
      'closed_at',
      'response_time_min',
      'resolution_time_min',
      'sla_breached',
    ];

    const csvRows = rows.map((row) => [
      row.id,
      row.title,
      row.status,
      row.priority,
      row.teamName,
      row.assigneeName,
      row.createdAt.toISOString(),
      row.closedAt ? row.closedAt.toISOString() : '',
      row.firstResponseAt
        ? this.round((row.firstResponseAt.getTime() - row.createdAt.getTime()) / 60_000)
        : '',
      row.closedAt ? this.round((row.closedAt.getTime() - row.createdAt.getTime()) / 60_000) : '',
      row.slaBreached ? 'yes' : 'no',
    ]);

    return toCsv(headers, csvRows);
  }

  // ===== Report constructor =====

  async runReport(dto: RunReportDto, actor: JwtPayload): Promise<PublicGroupedReport> {
    const rows = await this.reportsRepository.groupedReport(
      dto.groupBy,
      this.withDefaultPeriod(dto.filters),
      computeStaffRestrictions(actor),
    );
    return {
      groupBy: dto.groupBy,
      groupLabel: GROUP_LABELS[dto.groupBy],
      rows: rows.map((row) => this.toPublicRow(row)),
    };
  }

  async exportGroupedReportCsv(dto: RunReportDto, actor: JwtPayload): Promise<string> {
    const report = await this.runReport(dto, actor);
    return this.groupedReportToCsv(report, dto.columns);
  }

  async exportGroupedReportXml(dto: RunReportDto, actor: JwtPayload): Promise<string> {
    const report = await this.runReport(dto, actor);
    return this.groupedReportToXml(report, dto.columns);
  }

  // ===== Экспорт заявок — raw filtered ticket list, not grouped =====

  async exportTicketsCsv(filters: ReportFiltersDto, actor: JwtPayload): Promise<string> {
    const rows = await this.reportsRepository.exportTicketRows(
      this.withDefaultPeriod(filters),
      computeStaffRestrictions(actor),
    );
    const headers = [
      '№',
      'Тема',
      'Статус',
      'Приоритет',
      'Тип',
      'Отдел',
      'Исполнитель',
      'Клиент',
      'Создано',
      'Завершено',
    ];
    const csvRows = rows.map((row) => [
      row.ticketNumber,
      row.title,
      row.status,
      row.priority,
      row.type,
      row.teamName,
      row.assigneeName,
      row.clientName,
      row.createdAt.toISOString(),
      row.closedAt ? row.closedAt.toISOString() : '',
    ]);
    return toCsv(headers, csvRows);
  }

  // ===== Отчёт по меткам — детализация (метка + тикет), not aggregated =====
  // The aggregate breakdown by tag is already the generic constructor's
  // groupBy=tag (runReport/exportGroupedReportCsv above) — this is only the
  // per-(tag,ticket)-pair drill-down that the constructor's own CSV export
  // can't produce (it's grouped, one row per tag, not per ticket).

  async exportTagDetailCsv(filters: ReportFiltersDto, actor: JwtPayload): Promise<string> {
    const rows = await this.reportsRepository.tagDetailRows(
      this.withDefaultPeriod(filters),
      computeStaffRestrictions(actor),
    );
    const headers = ['Метка', '№ тикета', 'Тема', 'Статус', 'Отдел', 'Создано'];
    const csvRows = rows.map((row) => [
      row.tagName,
      row.ticketNumber,
      row.ticketTitle,
      row.status,
      row.teamName,
      row.createdAt.toISOString(),
    ]);
    return toCsv(headers, csvRows);
  }

  // ===== Отчёт по аудиту — aggregates ticket_activities, not tickets =====

  async getAuditSummary(dto: AuditReportQueryDto, actor: JwtPayload): Promise<PublicAuditSummaryRow[]> {
    const rows = await this.reportsRepository.auditActivitySummary(
      dto.groupBy,
      new Date(dto.from),
      new Date(dto.to),
      computeStaffRestrictions(actor),
    );
    return rows.map((row) => ({ key: row.key, label: row.label, role: row.role, count: row.count }));
  }

  async exportAuditSummaryCsv(dto: AuditReportQueryDto, actor: JwtPayload): Promise<string> {
    const rows = await this.getAuditSummary(dto, actor);
    const headers = dto.groupBy === 'actor' ? ['Сотрудник', 'Роль', 'Количество'] : ['Тип действия', 'Количество'];
    const csvRows =
      dto.groupBy === 'actor'
        ? rows.map((row) => [row.label, row.role ?? '', row.count])
        : rows.map((row) => [row.label, row.count]);
    return toCsv(headers, csvRows);
  }

  // ===== Глобальный аудит настроек — settings_audit_log, not tickets or
  // ticket_activities. A raw listing (see settingsAuditLog's own comment),
  // not an aggregate — the constructor/audit report above answer "how much
  // activity", this answers "which specific change, by whom, when".

  async getSettingsAuditLog(dto: SettingsAuditQueryDto): Promise<PublicSettingsAuditLogRow[]> {
    const rows = await this.reportsRepository.settingsAuditLog({
      from: new Date(dto.from),
      to: new Date(dto.to),
      actorId: dto.actorId,
      module: dto.module,
      eventType: dto.eventType,
    });
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      actorId: row.actorId,
      actorName: row.actorName,
      module: row.module,
      eventType: row.eventType,
      entityId: row.entityId,
      entityLabel: row.entityLabel,
      changes: row.changes,
    }));
  }

  async exportSettingsAuditLogCsv(dto: SettingsAuditQueryDto): Promise<string> {
    const rows = await this.getSettingsAuditLog(dto);
    const headers = ['Дата', 'Сотрудник', 'Модуль', 'Событие', 'Объект', 'Изменения'];
    const csvRows = rows.map((row) => [
      row.createdAt,
      row.actorName,
      row.module,
      row.eventType,
      row.entityLabel,
      row.changes ? JSON.stringify(row.changes) : '',
    ]);
    return toCsv(headers, csvRows);
  }

  // ===== Отчёт по CSAT — aggregates csat_answers, not tickets =====

  async getCsatSummary(dto: CsatReportQueryDto, actor: JwtPayload): Promise<CsatSummaryData> {
    const { from, to } = this.resolvePeriod(dto);
    return this.reportsRepository.csatSummary(
      {
        teamId: dto.teamId,
        assigneeId: dto.assigneeId,
        from,
        to,
      },
      computeStaffRestrictions(actor),
    );
  }

  // byQuestion/byOperator are small, on-screen-readable aggregates (one row
  // per question/operator) — the ticket-level drill-down is the one worth a
  // spreadsheet, same reasoning as «Отчёт по меткам»'s detail export next to
  // its own aggregate view.
  async exportCsatSummaryCsv(dto: CsatReportQueryDto, actor: JwtPayload): Promise<string> {
    const summary = await this.getCsatSummary(dto, actor);
    const headers = ['№ тикета', 'Тема', 'Клиент', 'Оператор', 'Дата оценки', 'Средний балл'];
    const csvRows = summary.byTicket.map((row) => [
      row.ticketNumber,
      row.ticketTitle,
      row.clientName,
      row.assigneeName || '',
      row.submittedAt.toISOString(),
      row.avgScore,
    ]);
    return toCsv(headers, csvRows);
  }

  // ===== Отчёт по операторам — reuses groupedReport(ASSIGNEE, ...) for the
  // ticket-side metrics already covered by the constructor, merges in three
  // metrics no ticket-grouped query can produce: time-in-status (reads
  // employee_status_history, not tickets), response-return speed and FCR%
  // (both need comment-level timing, not just ticket-level aggregates). No
  // "source" filter — same reason as «Отчёт по меткам»: the schema has no
  // ticket-source/channel concept to filter by at all. Admin-only, so (like
  // csatSummary) no StaffRestrictions — an admin's own restrictions are
  // always unrestricted anyway.

  async getOperatorSummary(dto: OperatorReportQueryDto, actor: JwtPayload): Promise<PublicOperatorReport> {
    const { from, to } = this.resolvePeriod(dto);
    const ticketFilters = {
      teamId: dto.teamId,
      dateField: ReportDateField.CREATED,
      from: from.toISOString(),
      to: to.toISOString(),
    };
    const restrictions = computeStaffRestrictions(actor);

    // Only operatorStatusTime actually depends on groupedReport's result
    // (operatorIds) — responseReturn/fcr take dto.teamId directly, so they
    // don't need to wait for it either. Starting all three independent
    // queries together, then statusTime once operatorIds is known, is the
    // fastest achievable ordering for this dependency shape.
    const [ticketRows, responseReturnRows, fcrRows] = await Promise.all([
      this.reportsRepository.groupedReport(ReportGroupBy.ASSIGNEE, ticketFilters, restrictions),
      this.reportsRepository.operatorResponseReturnSpeed(from, to, dto.teamId, restrictions),
      this.reportsRepository.operatorFcr(from, to, dto.teamId, restrictions),
    ]);
    const operatorIds = ticketRows.map((row) => row.entityId).filter((id): id is string => id !== null);
    const statusTimeRows = await this.reportsRepository.operatorStatusTime(from, to, operatorIds);

    const statusTimeByUser = new Map<string, PublicOperatorStatusTime[]>();
    for (const row of statusTimeRows) {
      const list = statusTimeByUser.get(row.userId) ?? [];
      list.push({ statusName: row.statusName, minutes: this.round(Number(row.minutes)) ?? 0 });
      statusTimeByUser.set(row.userId, list);
    }
    const responseReturnByUser = new Map(responseReturnRows.map((row) => [row.assigneeId, row]));
    const fcrByUser = new Map(fcrRows.map((row) => [row.assigneeId, row]));

    const rows: PublicOperatorRow[] = ticketRows.map((row) => {
      const publicRow = this.toPublicRow(row);
      const responseReturn = row.entityId ? responseReturnByUser.get(row.entityId) : undefined;
      const fcr = row.entityId ? fcrByUser.get(row.entityId) : undefined;
      return {
        assigneeId: publicRow.entityId,
        assigneeName: publicRow.entityName,
        total: publicRow.total,
        statusCounts: publicRow.statusCounts,
        avgResponseMinutes: publicRow.avgResponseMinutes,
        avgResolutionMinutes: publicRow.avgResolutionMinutes,
        slaComplianceRate: publicRow.slaComplianceRate,
        weightedKpi: publicRow.weightedKpi,
        statusTime: (row.entityId && statusTimeByUser.get(row.entityId)) || [],
        responseReturnMinutes: responseReturn ? this.round(Number(responseReturn.avgMinutes)) : null,
        fcrRate: fcr && fcr.resolvedTotal > 0 ? this.round((fcr.fcrCount / fcr.resolvedTotal) * 100) : null,
      };
    });

    return { from: from.toISOString(), to: to.toISOString(), rows };
  }

  // statusTime is a per-operator array (one entry per status name actually
  // used) — flattened into one semicolon-joined cell since a CSV row can't
  // hold nested data, same shape the frontend already renders it in.
  async exportOperatorSummaryCsv(dto: OperatorReportQueryDto, actor: JwtPayload): Promise<string> {
    const [report, statuses] = await Promise.all([
      this.getOperatorSummary(dto, actor),
      this.reportsRepository.listStatuses(),
    ]);
    const headers = [
      'Оператор',
      'Всего',
      // One column per live status — replaces the old fixed "Передано
      // разработчикам"/"Завершено" pair, which couldn't express a custom
      // admin-added status.
      ...statuses.map((s) => s.name),
      'Ср. первый ответ (мин)',
      'Ср. время решения (мин)',
      '% SLA',
      'KPI (взвеш.)',
      'Время по статусам',
      'Скорость возврата (мин)',
      '% FCR',
    ];
    const csvRows = report.rows.map((row) => [
      row.assigneeName,
      row.total,
      ...statuses.map((s) => row.statusCounts[s.id] ?? 0),
      row.avgResponseMinutes ?? '',
      row.avgResolutionMinutes ?? '',
      row.slaComplianceRate ?? '',
      row.weightedKpi,
      row.statusTime.map((entry) => `${entry.statusName}: ${entry.minutes} мин`).join('; '),
      row.responseReturnMinutes ?? '',
      row.fcrRate ?? '',
    ]);
    return toCsv(headers, csvRows);
  }

  async createSavedReport(dto: CreateSavedReportDto, createdBy: string | null): Promise<PublicSavedReport> {
    const saved = await this.savedReportsRepository.create({
      name: dto.name,
      groupBy: dto.groupBy,
      filters: dto.filters,
      columns: dto.columns ?? null,
      createdBy,
    });
    return toPublicSavedReport(saved);
  }

  async listSavedReports(): Promise<PublicSavedReport[]> {
    const reports = await this.savedReportsRepository.findAll();
    return reports.map(toPublicSavedReport);
  }

  async updateSavedReport(id: string, dto: UpdateSavedReportDto): Promise<PublicSavedReport> {
    await this.getSavedReportOrThrow(id);
    // Same guard as ArticlesService.update — TypeORM's Repository.update()
    // throws UpdateValuesMissingError (an uncaught 500) when the SET clause
    // would be empty, e.g. a PATCH body of `{}`. All fields here are optional.
    const patch: Partial<SavedReportData> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.groupBy !== undefined) patch.groupBy = dto.groupBy;
    if (dto.filters !== undefined) patch.filters = dto.filters;
    if (dto.columns !== undefined) patch.columns = dto.columns;
    if (Object.keys(patch).length > 0) {
      await this.savedReportsRepository.update(id, patch);
    }
    const updated = await this.getSavedReportOrThrow(id);
    return toPublicSavedReport(updated);
  }

  async removeSavedReport(id: string): Promise<void> {
    await this.getSavedReportOrThrow(id);
    await this.savedReportsRepository.delete(id);
  }

  private async getSavedReportOrThrow(id: string) {
    const report = await this.savedReportsRepository.findById(id);
    if (!report) {
      throw new NotFoundException('Saved report not found');
    }
    return report;
  }

  private toPublicRow(row: GroupedReportRow): PublicGroupedReportRow {
    return {
      entityId: row.entityId,
      entityName: row.entityName,
      total: row.total,
      statusCounts: row.statusCounts,
      avgResponseMinutes: this.round(this.toNullableNumber(row.avgResponseMinutes)),
      avgResolutionMinutes: this.round(this.toNullableNumber(row.avgResolutionMinutes)),
      slaComplianceRate: row.slaTotal === 0 ? null : this.round((row.slaCompliant / row.slaTotal) * 100),
      weightedKpi: Number(row.weightedKpi),
    };
  }

  // Built per request, not a module constant — the per-status columns
  // depend on the live ticket_statuses catalog. Order: total, then every
  // status in its admin-set sortOrder, then the fixed metric columns (same
  // overall order the old fixed 9-column layout used).
  private async buildColumnDefs(): Promise<{ keys: ReportColumnKey[]; defs: Record<ReportColumnKey, ReportColumnDef> }> {
    const statuses = await this.reportsRepository.listStatuses();
    const defs: Record<ReportColumnKey, ReportColumnDef> = {
      total: { header: 'Всего', value: (r) => r.total },
      avgResponseMinutes: { header: 'Ср. первый ответ (мин)', value: (r) => r.avgResponseMinutes ?? '' },
      avgResolutionMinutes: { header: 'Ср. время решения (мин)', value: (r) => r.avgResolutionMinutes ?? '' },
      slaComplianceRate: { header: '% SLA', value: (r) => r.slaComplianceRate ?? '' },
      weightedKpi: { header: 'KPI (взвеш.)', value: (r) => r.weightedKpi },
    };
    const keys: ReportColumnKey[] = ['total'];
    for (const status of statuses) {
      const key = statusColumnKey(status.id);
      defs[key] = { header: status.name, value: (r) => r.statusCounts[status.id] ?? 0 };
      keys.push(key);
    }
    keys.push('avgResponseMinutes', 'avgResolutionMinutes', 'slaComplianceRate', 'weightedKpi');
    return { keys, defs };
  }

  // `columns` is the same list the frontend already tracks for on-screen
  // visibility (ColumnKey in ReportsPage.tsx) — an absent/empty list means
  // "all columns", matching how the table itself defaults to fully visible.
  // Unknown keys are silently dropped rather than rejected, since a stale
  // saved-report `columns` value (from before a column existed, or after one
  // was renamed) shouldn't break the export.
  private resolveReportColumnKeys(columns: string[] | undefined, allKeys: ReportColumnKey[]): ReportColumnKey[] {
    if (!columns?.length) return allKeys;
    const known = new Set<string>(allKeys);
    const filtered = columns.filter((key): key is ReportColumnKey => known.has(key));
    return filtered.length ? filtered : allKeys;
  }

  private async reportHeadersAndRows(report: PublicGroupedReport, columns?: string[]): Promise<{ headers: string[]; rows: (string | number)[][] }> {
    const { keys: allKeys, defs } = await this.buildColumnDefs();
    const keys = this.resolveReportColumnKeys(columns, allKeys);
    const headers = [report.groupLabel, ...keys.map((key) => defs[key].header)];
    const rows = report.rows.map((row) => [row.entityName, ...keys.map((key) => defs[key].value(row))]);
    return { headers, rows };
  }

  private async groupedReportToCsv(report: PublicGroupedReport, columns?: string[]): Promise<string> {
    const { headers, rows } = await this.reportHeadersAndRows(report, columns);
    return toCsv(headers, rows);
  }

  private async groupedReportToXml(report: PublicGroupedReport, columns?: string[]): Promise<string> {
    const { headers, rows } = await this.reportHeadersAndRows(report, columns);
    return toXml(headers, rows);
  }

  // Postgres numeric aggregates (AVG) come back as strings over the driver
  // — same reason exportCsv's fields need explicit Number() below.
  private toNullableNumber(value: unknown): number | null {
    return value === null || value === undefined ? null : Number(value);
  }

  private resolvePeriod(query: ReportPeriodQueryDto): { from: Date; to: Date } {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - DEFAULT_PERIOD_DAYS * MS_PER_DAY);
    return { from, to };
  }

  // The constructor/raw-export/tag-detail filters accept from/to as
  // genuinely optional (no 400 either way, per ReportFiltersDto's own
  // comment) — but "optional" must mean "defaults to 30 days", not
  // "unbounded", or a caller who forgets the date range scans the entire
  // tickets/comments/ticket_activities history in one request. Same default
  // window as resolvePeriod, just re-serialized onto the filters object
  // instead of returned as bare Dates, since the repository layer expects
  // ReportFiltersDto's string fields.
  private withDefaultPeriod(filters: ReportFiltersDto): ReportFiltersDto {
    const { from, to } = this.resolvePeriod(filters);
    return { ...filters, from: from.toISOString(), to: to.toISOString() };
  }

  private round(value: number | null): number | null {
    return value === null ? null : Math.round(value * 10) / 10;
  }
}
