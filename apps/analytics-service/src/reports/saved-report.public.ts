import { SavedReportEntity } from '@veloxdesk/database';
import type { ReportFilters, ReportGroupBy } from '@veloxdesk/types';

export interface PublicSavedReport {
  id: string;
  name: string;
  groupBy: ReportGroupBy;
  filters: ReportFilters;
  columns: string[] | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicSavedReport(report: SavedReportEntity): PublicSavedReport {
  return {
    id: report.id,
    name: report.name,
    groupBy: report.groupBy,
    filters: report.filters,
    columns: report.columns ?? null,
    createdBy: report.createdBy ?? null,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  };
}
