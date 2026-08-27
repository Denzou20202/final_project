import { JwtPayload } from '@veloxdesk/common';
import { ReportDateField, ReportGroupBy, UserRole } from '@veloxdesk/types';
import { NotFoundException } from '@nestjs/common';
import { GroupedReportRow, ReportsRepository } from './reports.repository.js';
import { ReportsService } from './reports.service.js';
import { SavedReportsRepository } from './saved-reports.repository.js';

function makeActor(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return { sub: 'operator-1', email: 'operator@veloxdesk.local', role: UserRole.OPERATOR, ...overrides };
}

// Matches the seed statuses' names exactly, so exportGroupedReportCsv's
// header assertions below stay meaningful.
const FIXTURE_STATUSES = [
  { id: 'status-open', name: 'В работе' },
  { id: 'status-pending', name: 'Ожидание' },
  { id: 'status-resolved', name: 'Передано разработчикам' },
  { id: 'status-closed', name: 'Завершено' },
];

function makeRow(overrides: Partial<GroupedReportRow> = {}): GroupedReportRow {
  return {
    entityId: 'user-1',
    entityName: 'Иванов',
    total: 3,
    statusCounts: { 'status-open': 1, 'status-pending': 0, 'status-resolved': 0, 'status-closed': 2 },
    avgResponseMinutes: 12.34,
    avgResolutionMinutes: null,
    slaTotal: 2,
    slaCompliant: 1,
    weightedKpi: 4,
    ...overrides,
  };
}

describe('ReportsService (report constructor)', () => {
  let reportsRepository: jest.Mocked<Pick<ReportsRepository, 'groupedReport' | 'listStatuses'>>;
  let savedReportsRepository: jest.Mocked<
    Pick<SavedReportsRepository, 'create' | 'findAll' | 'findById' | 'update' | 'delete'>
  >;
  let service: ReportsService;

  const runDto = { groupBy: ReportGroupBy.ASSIGNEE, filters: { dateField: ReportDateField.CREATED } };

  beforeEach(() => {
    reportsRepository = { groupedReport: jest.fn(), listStatuses: jest.fn().mockResolvedValue(FIXTURE_STATUSES) };
    savedReportsRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    service = new ReportsService(
      reportsRepository as unknown as ReportsRepository,
      savedReportsRepository as unknown as SavedReportsRepository,
    );
  });

  it('maps rows, rounding averages to one decimal', async () => {
    reportsRepository.groupedReport.mockResolvedValue([makeRow()]);

    const report = await service.runReport(runDto, makeActor());

    expect(report.groupLabel).toBe('Оператор');
    expect(report.rows[0].avgResponseMinutes).toBe(12.3);
    expect(report.rows[0].avgResolutionMinutes).toBeNull();
  });

  it('computes SLA compliance percentage and nulls it when no ticket has an SLA', async () => {
    reportsRepository.groupedReport.mockResolvedValue([
      makeRow({ slaTotal: 4, slaCompliant: 3 }),
      makeRow({ entityId: 'user-2', slaTotal: 0, slaCompliant: 0 }),
    ]);

    const report = await service.runReport(runDto, makeActor());

    expect(report.rows[0].slaComplianceRate).toBe(75);
    expect(report.rows[1].slaComplianceRate).toBeNull();
  });

  it('coerces numeric-string aggregates from the pg driver', async () => {
    reportsRepository.groupedReport.mockResolvedValue([
      makeRow({ avgResponseMinutes: '7.77' as unknown as number }),
    ]);

    const report = await service.runReport(runDto, makeActor());

    expect(report.rows[0].avgResponseMinutes).toBe(7.8);
  });

  it('exports the grouped report as CSV with localized headers', async () => {
    reportsRepository.groupedReport.mockResolvedValue([makeRow()]);

    const csv = await service.exportGroupedReportCsv(runDto, makeActor());

    expect(csv).toContain('Оператор,Всего,В работе');
    expect(csv).toContain('Иванов,3,1');
  });

  // Regression test for the report-constructor data leak: a restricted admin
  // (restrictToDepartments/restrictToOwnTickets set on their permission
  // group, independent of role — see UserEntity.cannotManageAdmins) must get
  // the same StaffRestrictions applied here as getDashboard/getTeamLoad/
  // exportCsv already do, not org-wide data.
  it('scopes the report constructor to the actor’s departments when restrictToDepartments is set', async () => {
    reportsRepository.groupedReport.mockResolvedValue([]);

    await service.runReport(runDto, makeActor({ role: UserRole.ADMIN, restrictToDepartments: true, departmentIds: ['team-1'] }));

    expect(reportsRepository.groupedReport).toHaveBeenCalledWith(runDto.groupBy, expect.anything(), {
      restrictDepartmentIds: ['team-1'],
      restrictToUserId: undefined,
    });
  });

  it('throws NotFound when updating a missing saved report', async () => {
    savedReportsRepository.findById.mockResolvedValue(null);

    await expect(service.updateSavedReport('missing-id', { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    expect(savedReportsRepository.update).not.toHaveBeenCalled();
  });

  it('throws NotFound when deleting a missing saved report', async () => {
    savedReportsRepository.findById.mockResolvedValue(null);

    await expect(service.removeSavedReport('missing-id')).rejects.toBeInstanceOf(NotFoundException);
    expect(savedReportsRepository.delete).not.toHaveBeenCalled();
  });
});

describe('ReportsService dashboard/team-load/export — permission-group scoping', () => {
  let reportsRepository: jest.Mocked<
    Pick<ReportsRepository, 'statusBreakdown' | 'averageResponseMinutes' | 'averageResolutionMinutes' | 'slaCompliance' | 'teamLoad' | 'exportRows'>
  >;
  let service: ReportsService;

  beforeEach(() => {
    reportsRepository = {
      statusBreakdown: jest.fn().mockResolvedValue([]),
      averageResponseMinutes: jest.fn().mockResolvedValue(null),
      averageResolutionMinutes: jest.fn().mockResolvedValue(null),
      slaCompliance: jest.fn().mockResolvedValue({ totalWithSla: 0, compliantCount: 0 }),
      teamLoad: jest.fn().mockResolvedValue([]),
      exportRows: jest.fn().mockResolvedValue([]),
    };
    service = new ReportsService(reportsRepository as unknown as ReportsRepository, {} as unknown as SavedReportsRepository);
  });

  it('passes no restrictions for an unrestricted operator', async () => {
    await service.getDashboard({}, makeActor());

    expect(reportsRepository.statusBreakdown).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), {
      restrictDepartmentIds: undefined,
      restrictToUserId: undefined,
    });
  });

  it('scopes the dashboard to the actor’s departments when restrictToDepartments is set', async () => {
    await service.getDashboard({}, makeActor({ restrictToDepartments: true, departmentIds: ['team-1'] }));

    for (const fn of [
      reportsRepository.statusBreakdown,
      reportsRepository.averageResponseMinutes,
      reportsRepository.averageResolutionMinutes,
      reportsRepository.slaCompliance,
    ]) {
      expect(fn).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), {
        restrictDepartmentIds: ['team-1'],
        restrictToUserId: undefined,
      });
    }
  });

  it('scopes team-load to the actor’s own tickets when restrictToOwnTickets is set', async () => {
    await service.getTeamLoad({}, makeActor({ restrictToOwnTickets: true }));

    expect(reportsRepository.teamLoad).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), {
      restrictDepartmentIds: undefined,
      restrictToUserId: 'operator-1',
    });
  });

  it('scopes the CSV export the same way as the dashboard', async () => {
    await service.exportCsv({}, makeActor({ restrictToDepartments: true, departmentIds: [] }));

    expect(reportsRepository.exportRows).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), {
      restrictDepartmentIds: [],
      restrictToUserId: undefined,
    });
  });
});
