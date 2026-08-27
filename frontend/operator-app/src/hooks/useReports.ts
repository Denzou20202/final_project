import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AuditReportInput,
  createSavedReport,
  CsatReportInput,
  deleteSavedReport,
  downloadAuditSummaryCsv,
  downloadCsatSummaryCsv,
  downloadOperatorSummaryCsv,
  downloadReportCsv,
  downloadRunReportCsv,
  downloadRunReportXml,
  downloadSettingsAuditLogCsv,
  downloadTagDetailCsv,
  downloadTicketsCsv,
  fetchAuditSummary,
  fetchCsatSummary,
  fetchDashboard,
  fetchOperatorSummary,
  fetchSettingsAuditLog,
  fetchTeamLoad,
  listSavedReports,
  OperatorReportInput,
  ReportPeriod,
  RunReportInput,
  runReport,
  SaveReportInput,
  SettingsAuditReportInput,
  updateSavedReport,
} from '../lib/api/reports.api.js';
import type { ReportFilters } from '../lib/types.js';

export function useDashboard(period: ReportPeriod) {
  return useQuery({
    queryKey: ['reports', 'dashboard', period],
    queryFn: () => fetchDashboard(period),
  });
}

export function useTeamLoad(period: ReportPeriod) {
  return useQuery({
    queryKey: ['reports', 'team-load', period],
    queryFn: () => fetchTeamLoad(period),
  });
}

export function useDownloadReportCsv() {
  return useMutation({
    mutationFn: downloadReportCsv,
  });
}

// ===== Report constructor =====

// A mutation, not a query — the constructor only runs on the explicit
// «Показать» click, not on every keystroke while adjusting filters.
export function useRunReport() {
  return useMutation({
    mutationFn: (input: RunReportInput) => runReport(input),
  });
}

export function useDownloadRunReportCsv() {
  return useMutation({
    mutationFn: downloadRunReportCsv,
  });
}

export function useDownloadRunReportXml() {
  return useMutation({
    mutationFn: downloadRunReportXml,
  });
}

export function useSavedReports() {
  return useQuery({
    queryKey: ['saved-reports'],
    queryFn: listSavedReports,
  });
}

export function useCreateSavedReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveReportInput) => createSavedReport(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-reports'] }),
  });
}

export function useUpdateSavedReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<SaveReportInput>) => updateSavedReport(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-reports'] }),
  });
}

export function useDeleteSavedReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteSavedReport,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-reports'] }),
  });
}

// ===== Экспорт заявок =====

export function useDownloadTicketsCsv() {
  return useMutation({
    mutationFn: (filters: ReportFilters) => downloadTicketsCsv(filters),
  });
}

// ===== Отчёт по меткам (детализация) =====

export function useDownloadTagDetailCsv() {
  return useMutation({
    mutationFn: (filters: ReportFilters) => downloadTagDetailCsv(filters),
  });
}

// ===== Отчёт по аудиту =====

// A mutation (not a query) — same reasoning as useRunReport: only runs on
// an explicit «Показать», not on every filter keystroke.
export function useAuditSummary() {
  return useMutation({
    mutationFn: (input: AuditReportInput) => fetchAuditSummary(input),
  });
}

export function useDownloadAuditSummaryCsv() {
  return useMutation({
    mutationFn: (input: AuditReportInput) => downloadAuditSummaryCsv(input),
  });
}

// ===== Глобальный аудит настроек =====

export function useSettingsAuditLog() {
  return useMutation({
    mutationFn: (input: SettingsAuditReportInput) => fetchSettingsAuditLog(input),
  });
}

export function useDownloadSettingsAuditLogCsv() {
  return useMutation({
    mutationFn: (input: SettingsAuditReportInput) => downloadSettingsAuditLogCsv(input),
  });
}

// ===== Отчёт по CSAT =====

// A mutation (not a query) — same reasoning as useAuditSummary/useRunReport.
export function useCsatSummary() {
  return useMutation({
    mutationFn: (input: CsatReportInput) => fetchCsatSummary(input),
  });
}

export function useDownloadCsatSummaryCsv() {
  return useMutation({
    mutationFn: (input: CsatReportInput) => downloadCsatSummaryCsv(input),
  });
}

// ===== Отчёт по операторам =====

export function useOperatorSummary() {
  return useMutation({
    mutationFn: (input: OperatorReportInput) => fetchOperatorSummary(input),
  });
}

export function useDownloadOperatorSummaryCsv() {
  return useMutation({
    mutationFn: (input: OperatorReportInput) => downloadOperatorSummaryCsv(input),
  });
}
