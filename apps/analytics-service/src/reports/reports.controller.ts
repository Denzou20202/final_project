import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@veloxdesk/common';
import type { JwtPayload } from '@veloxdesk/common';
import { UserRole } from '@veloxdesk/types';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuditReportQueryDto } from './dto/audit-report-query.dto.js';
import { CreateSavedReportDto } from './dto/create-saved-report.dto.js';
import { CsatReportQueryDto } from './dto/csat-report-query.dto.js';
import { OperatorReportQueryDto } from './dto/operator-report-query.dto.js';
import { ReportFiltersDto } from './dto/report-filters.dto.js';
import { SettingsAuditQueryDto } from './dto/settings-audit-query.dto.js';
import { ReportPeriodQueryDto } from './dto/report-period-query.dto.js';
import { RunReportDto } from './dto/run-report.dto.js';
import { UpdateSavedReportDto } from './dto/update-saved-report.dto.js';
import { ReportsService } from './reports.service.js';

// Dashboard endpoints (dashboard/team-load/export below) back «Дашборд»
// (AnalyticsPage) — that's a normal operator page, not the admin-only
// «Отчёты» section, so the class-level role stays OPERATOR+ADMIN. Only the
// report CONSTRUCTOR and saved reports further down are admin-only
// (method-level @Roles overrides the class-level one — see RolesGuard).
@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OPERATOR, UserRole.ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  getDashboard(@Query() query: ReportPeriodQueryDto, @CurrentUser() actor: JwtPayload) {
    return this.reportsService.getDashboard(query, actor);
  }

  @Get('team-load')
  getTeamLoad(@Query() query: ReportPeriodQueryDto, @CurrentUser() actor: JwtPayload) {
    return this.reportsService.getTeamLoad(query, actor);
  }

  @Get('export')
  async exportCsv(@Query() query: ReportPeriodQueryDto, @CurrentUser() actor: JwtPayload, @Res() res: Response): Promise<void> {
    const csv = await this.reportsService.exportCsv(query, actor);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="veloxdesk-report-${Date.now()}.csv"`);
    res.send(csv);
  }

  // ===== Report constructor — admin-only «Отчёты» section =====

  @Roles(UserRole.ADMIN)
  @Post('run')
  runReport(@Body() dto: RunReportDto, @CurrentUser() actor: JwtPayload) {
    return this.reportsService.runReport(dto, actor);
  }

  @Roles(UserRole.ADMIN)
  @Post('run/export')
  async exportRunCsv(@Body() dto: RunReportDto, @CurrentUser() actor: JwtPayload, @Res() res: Response): Promise<void> {
    const csv = await this.reportsService.exportGroupedReportCsv(dto, actor);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="veloxdesk-report-${Date.now()}.csv"`);
    res.send(csv);
  }

  @Roles(UserRole.ADMIN)
  @Post('run/export/xml')
  async exportRunXml(@Body() dto: RunReportDto, @CurrentUser() actor: JwtPayload, @Res() res: Response): Promise<void> {
    const xml = await this.reportsService.exportGroupedReportXml(dto, actor);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="veloxdesk-report-${Date.now()}.xml"`);
    res.send(xml);
  }

  // «Экспорт заявок» — filtered raw ticket list, admin-only like the rest
  // of the constructor section.
  @Roles(UserRole.ADMIN)
  @Post('export-tickets')
  async exportTickets(@Body() dto: ReportFiltersDto, @CurrentUser() actor: JwtPayload, @Res() res: Response): Promise<void> {
    const csv = await this.reportsService.exportTicketsCsv(dto, actor);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="veloxdesk-tickets-${Date.now()}.csv"`);
    res.send(csv);
  }

  // «Отчёт по меткам» — детализация (метка + тикет), admin-only. The
  // aggregate breakdown by tag already works today through /reports/run with
  // groupBy=tag — this endpoint is only the CSV drill-down that view can't
  // produce.
  @Roles(UserRole.ADMIN)
  @Post('tags/export')
  async exportTagDetail(@Body() dto: ReportFiltersDto, @CurrentUser() actor: JwtPayload, @Res() res: Response): Promise<void> {
    const csv = await this.reportsService.exportTagDetailCsv(dto, actor);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="veloxdesk-tags-${Date.now()}.csv"`);
    res.send(csv);
  }

  // «Отчёт по аудиту» — aggregates ticket_activities, admin-only.
  @Roles(UserRole.ADMIN)
  @Post('audit')
  getAuditSummary(@Body() dto: AuditReportQueryDto, @CurrentUser() actor: JwtPayload) {
    return this.reportsService.getAuditSummary(dto, actor);
  }

  @Roles(UserRole.ADMIN)
  @Post('audit/export')
  async exportAuditSummary(@Body() dto: AuditReportQueryDto, @CurrentUser() actor: JwtPayload, @Res() res: Response): Promise<void> {
    const csv = await this.reportsService.exportAuditSummaryCsv(dto, actor);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="veloxdesk-audit-${Date.now()}.csv"`);
    res.send(csv);
  }

  // «Глобальный аудит настроек» — settings_audit_log, admin-only like the
  // ticket-activity audit report above.
  @Roles(UserRole.ADMIN)
  @Post('settings-audit')
  getSettingsAuditLog(@Body() dto: SettingsAuditQueryDto) {
    return this.reportsService.getSettingsAuditLog(dto);
  }

  @Roles(UserRole.ADMIN)
  @Post('settings-audit/export')
  async exportSettingsAuditLog(@Body() dto: SettingsAuditQueryDto, @Res() res: Response): Promise<void> {
    const csv = await this.reportsService.exportSettingsAuditLogCsv(dto);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="veloxdesk-settings-audit-${Date.now()}.csv"`);
    res.send(csv);
  }

  // «Оценка удовлетворённости (CSAT)» — aggregates csat_answers, admin-only
  // like the audit report above.
  @Roles(UserRole.ADMIN)
  @Post('csat')
  getCsatSummary(@Body() dto: CsatReportQueryDto, @CurrentUser() actor: JwtPayload) {
    return this.reportsService.getCsatSummary(dto, actor);
  }

  @Roles(UserRole.ADMIN)
  @Post('csat/export')
  async exportCsatSummary(@Body() dto: CsatReportQueryDto, @CurrentUser() actor: JwtPayload, @Res() res: Response): Promise<void> {
    const csv = await this.reportsService.exportCsatSummaryCsv(dto, actor);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="veloxdesk-csat-${Date.now()}.csv"`);
    res.send(csv);
  }

  // «Отчёт по операторам» — admin-only like audit/CSAT above.
  @Roles(UserRole.ADMIN)
  @Post('operators')
  getOperatorSummary(@Body() dto: OperatorReportQueryDto, @CurrentUser() actor: JwtPayload) {
    return this.reportsService.getOperatorSummary(dto, actor);
  }

  @Roles(UserRole.ADMIN)
  @Post('operators/export')
  async exportOperatorSummary(@Body() dto: OperatorReportQueryDto, @CurrentUser() actor: JwtPayload, @Res() res: Response): Promise<void> {
    const csv = await this.reportsService.exportOperatorSummaryCsv(dto, actor);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="veloxdesk-operators-${Date.now()}.csv"`);
    res.send(csv);
  }

  // Saved reports store the CONFIG only (group-by + filters), never a
  // point-in-time result — the frontend re-runs an opened report through
  // POST /run against live data, so there's no per-saved-report run/export
  // endpoint here.
  @Roles(UserRole.ADMIN)
  @Get('saved')
  listSaved() {
    return this.reportsService.listSavedReports();
  }

  @Roles(UserRole.ADMIN)
  @Post('saved')
  createSaved(@Body() dto: CreateSavedReportDto, @CurrentUser() actor: JwtPayload) {
    return this.reportsService.createSavedReport(dto, actor.sub);
  }

  @Roles(UserRole.ADMIN)
  @Patch('saved/:id')
  updateSaved(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSavedReportDto) {
    return this.reportsService.updateSavedReport(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('saved/:id')
  removeSaved(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportsService.removeSavedReport(id);
  }
}
