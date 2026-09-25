import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@veloxdesk/types';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

describe('ReportsController — report and export permissions', () => {
  let controller: ReportsController;
  let service: jest.Mocked<Partial<ReportsService>>;

  beforeEach(() => {
    service = {
      getDashboard: jest.fn().mockResolvedValue({} as never),
      getTeamLoad: jest.fn().mockResolvedValue({} as never),
      exportCsv: jest.fn().mockResolvedValue('csv-content'),
    };
    controller = new ReportsController(service as ReportsService);
  });

  it('allows admin to view dashboard even if canViewReports is false', async () => {
    const adminActor = { sub: 'admin-1', email: 'admin@veloxdesk.local', role: UserRole.ADMIN, canViewReports: false };
    await expect(controller.getDashboard({} as never, adminActor as never)).resolves.toBeDefined();
    expect(service.getDashboard).toHaveBeenCalled();
  });

  it('allows operator with canViewReports=true to view dashboard', async () => {
    const operatorActor = { sub: 'op-1', email: 'op@veloxdesk.local', role: UserRole.OPERATOR, canViewReports: true };
    await expect(controller.getDashboard({} as never, operatorActor as never)).resolves.toBeDefined();
  });

  it('blocks operator with canViewReports=false from viewing dashboard', async () => {
    const restrictedOperator = { sub: 'op-1', email: 'op@veloxdesk.local', role: UserRole.OPERATOR, canViewReports: false };
    expect(() => controller.getDashboard({} as never, restrictedOperator as never)).toThrow(ForbiddenException);
    expect(service.getDashboard).not.toHaveBeenCalled();
  });

  it('blocks operator with canViewReports=false from viewing team load', async () => {
    const restrictedOperator = { sub: 'op-1', email: 'op@veloxdesk.local', role: UserRole.OPERATOR, canViewReports: false };
    expect(() => controller.getTeamLoad({} as never, restrictedOperator as never)).toThrow(ForbiddenException);
    expect(service.getTeamLoad).not.toHaveBeenCalled();
  });

  it('blocks operator with canExportReports=false from exporting CSV', async () => {
    const restrictedExport = {
      sub: 'op-1',
      email: 'op@veloxdesk.local',
      role: UserRole.OPERATOR,
      canViewReports: true,
      canExportReports: false,
    };
    const res = { setHeader: jest.fn(), send: jest.fn() };
    await expect(controller.exportCsv({} as never, restrictedExport as never, res as never)).rejects.toThrow(ForbiddenException);
    expect(service.exportCsv).not.toHaveBeenCalled();
  });

  it('allows operator with canExportReports=true to export CSV', async () => {
    const allowedExport = {
      sub: 'op-1',
      email: 'op@veloxdesk.local',
      role: UserRole.OPERATOR,
      canViewReports: true,
      canExportReports: true,
    };
    const res = { setHeader: jest.fn(), send: jest.fn() };
    await controller.exportCsv({} as never, allowedExport as never, res as never);
    expect(service.exportCsv).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalledWith('csv-content');
  });
});
