import { analyticsApi } from './client.js';
import type {
  AuditSummaryRow,
  CsatSummary,
  DashboardReport,
  GroupedReport,
  OperatorReport,
  ReportFilters,
  ReportGroupBy,
  SavedReport,
  SettingsAuditLogRow,
  TeamLoadReport,
} from '../types.js';

export interface AuditReportInput {
  groupBy: 'type' | 'actor';
  from: string;
  to: string;
}

export interface ReportPeriod {
  from?: string;
  to?: string;
}

export interface RunReportInput {
  groupBy: ReportGroupBy;
  filters: ReportFilters;
  // Also honored by the CSV/XML export endpoints (not just saved reports)
  // — omitted means "all columns".
  columns?: string[];
}

export interface SaveReportInput extends RunReportInput {
  name: string;
  columns?: string[];
}

export async function fetchDashboard(period: ReportPeriod): Promise<DashboardReport> {
  const { data } = await analyticsApi.get<DashboardReport>('/reports/dashboard', { params: period });
  return data;
}

export async function fetchTeamLoad(period: ReportPeriod): Promise<TeamLoadReport> {
  const { data } = await analyticsApi.get<TeamLoadReport>('/reports/team-load', { params: period });
  return data;
}

// A plain <a href> can't carry the Authorization header, so files are
// fetched as blobs through the authenticated axios instance and then
// "downloaded" via a synthetic click on an object URL — the standard
// pattern for authenticated file downloads from an SPA.
function saveBlob(blob: Blob, filenamePrefix = 'report', extension = 'csv'): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `veloxdesk-${filenamePrefix}-${Date.now()}.${extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadReportCsv(period: ReportPeriod): Promise<void> {
  const response = await analyticsApi.get('/reports/export', { params: period, responseType: 'blob' });
  saveBlob(response.data as Blob);
}

// ===== Report constructor =====

export async function runReport(input: RunReportInput): Promise<GroupedReport> {
  const { data } = await analyticsApi.post<GroupedReport>('/reports/run', input);
  return data;
}

export async function downloadRunReportCsv(input: RunReportInput): Promise<void> {
  const response = await analyticsApi.post('/reports/run/export', input, { responseType: 'blob' });
  saveBlob(response.data as Blob);
}

export async function downloadRunReportXml(input: RunReportInput): Promise<void> {
  const response = await analyticsApi.post('/reports/run/export/xml', input, { responseType: 'blob' });
  saveBlob(response.data as Blob, 'report', 'xml');
}

export async function listSavedReports(): Promise<SavedReport[]> {
  const { data } = await analyticsApi.get<SavedReport[]>('/reports/saved');
  return data;
}

export async function createSavedReport(input: SaveReportInput): Promise<SavedReport> {
  const { data } = await analyticsApi.post<SavedReport>('/reports/saved', input);
  return data;
}

export async function updateSavedReport(id: string, input: Partial<SaveReportInput>): Promise<SavedReport> {
  const { data } = await analyticsApi.patch<SavedReport>(`/reports/saved/${id}`, input);
  return data;
}

export async function deleteSavedReport(id: string): Promise<void> {
  await analyticsApi.delete(`/reports/saved/${id}`);
}

// ===== Экспорт заявок =====

export async function downloadTicketsCsv(filters: ReportFilters): Promise<void> {
  const response = await analyticsApi.post('/reports/export-tickets', filters, { responseType: 'blob' });
  saveBlob(response.data as Blob, 'tickets');
}

// ===== Отчёт по меткам (детализация — метка + тикет) =====
// The aggregate breakdown by tag is already the constructor's groupBy=tag
// (runReport/downloadRunReportCsv above) — this is only the CSV drill-down
// with one row per (tag, ticket) pair, which the constructor's own export
// can't produce (it's grouped, one row per tag).

export async function downloadTagDetailCsv(filters: ReportFilters): Promise<void> {
  const response = await analyticsApi.post('/reports/tags/export', filters, { responseType: 'blob' });
  saveBlob(response.data as Blob, 'tags');
}

// ===== Отчёт по аудиту =====

export async function fetchAuditSummary(input: AuditReportInput): Promise<AuditSummaryRow[]> {
  const { data } = await analyticsApi.post<AuditSummaryRow[]>('/reports/audit', input);
  return data;
}

export async function downloadAuditSummaryCsv(input: AuditReportInput): Promise<void> {
  const response = await analyticsApi.post('/reports/audit/export', input, { responseType: 'blob' });
  saveBlob(response.data as Blob, 'audit');
}

// ===== Глобальный аудит настроек =====

export interface SettingsAuditReportInput {
  from: string;
  to: string;
  actorId?: string;
  module?: string;
  eventType?: string;
}

export async function fetchSettingsAuditLog(input: SettingsAuditReportInput): Promise<SettingsAuditLogRow[]> {
  const { data } = await analyticsApi.post<SettingsAuditLogRow[]>('/reports/settings-audit', input);
  return data;
}

export async function downloadSettingsAuditLogCsv(input: SettingsAuditReportInput): Promise<void> {
  const response = await analyticsApi.post('/reports/settings-audit/export', input, { responseType: 'blob' });
  saveBlob(response.data as Blob, 'settings-audit');
}

// ===== Отчёт по CSAT =====

export interface CsatReportInput {
  from?: string;
  to?: string;
  teamId?: string;
  assigneeId?: string;
}

export async function fetchCsatSummary(input: CsatReportInput): Promise<CsatSummary> {
  const { data } = await analyticsApi.post<CsatSummary>('/reports/csat', input);
  return data;
}

export async function downloadCsatSummaryCsv(input: CsatReportInput): Promise<void> {
  const response = await analyticsApi.post('/reports/csat/export', input, { responseType: 'blob' });
  saveBlob(response.data as Blob, 'csat');
}

// ===== Отчёт по операторам =====
// No source/channel filter — same reason as the tag report: the ticket
// schema has no such column to filter by at all.

export interface OperatorReportInput {
  from?: string;
  to?: string;
  teamId?: string;
}

export async function fetchOperatorSummary(input: OperatorReportInput): Promise<OperatorReport> {
  const { data } = await analyticsApi.post<OperatorReport>('/reports/operators', input);
  return data;
}

export async function downloadOperatorSummaryCsv(input: OperatorReportInput): Promise<void> {
  const response = await analyticsApi.post('/reports/operators/export', input, { responseType: 'blob' });
  saveBlob(response.data as Blob, 'operators');
}
