import { AutomationTrigger } from '@veloxdesk/types';
import { AutomationRulesService } from './automation-rules.service.js';

const redisSetMock = jest.fn();
jest.mock('ioredis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    set: redisSetMock,
    on: jest.fn(),
    disconnect: jest.fn(),
  })),
}));

function makeRule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rule-1',
    name: 'Test rule',
    trigger: AutomationTrigger.CLIENT_REPLIED,
    conditions: [],
    actions: [],
    isEnabled: true,
    sortOrder: 0,
    ...overrides,
  };
}

// Regression coverage for the automation-dispatcher redelivery bug: a
// worker dying mid-run (OOM/deploy restart) makes BullMQ redeliver the
// SAME stalled job, which used to re-run every matching rule from scratch —
// harmless for SET_STATUS/SET_PRIORITY/ASSIGN_TEAM/ASSIGN_USER (each
// no-ops if already at the target value) but not for APPLY_MACRO, which
// posts a brand-new duplicate reply on every call. runTrigger now claims
// each (jobId, ruleId) pair in Redis via SET NX before running it.
describe('AutomationRulesService.runTrigger — stalled-job redelivery idempotency', () => {
  let rulesRepository: { findEnabledByTrigger: jest.Mock };
  let ticketsService: { getSnapshotForAutomation: jest.Mock };
  let customFieldsService: { getValuesForTicket: jest.Mock };
  let service: AutomationRulesService;

  beforeEach(() => {
    redisSetMock.mockReset();
    rulesRepository = { findEnabledByTrigger: jest.fn().mockResolvedValue([makeRule()]) };
    ticketsService = {
      getSnapshotForAutomation: jest.fn().mockResolvedValue({
        status: { isDefault: false },
        statusId: 'status-1',
        priority: 'medium',
        teamId: null,
        assignedTo: null,
      }),
    };
    customFieldsService = { getValuesForTicket: jest.fn().mockResolvedValue([]) };
    service = new AutomationRulesService(
      rulesRepository as never,
      ticketsService as never,
      customFieldsService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { get: jest.fn((_key: string, fallback?: unknown) => fallback) } as never,
    );
  });

  it('runs the rule when the redis claim succeeds (first delivery)', async () => {
    redisSetMock.mockResolvedValue('OK');

    await service.runTrigger(AutomationTrigger.CLIENT_REPLIED, 'ticket-1', 'job-1');

    expect(redisSetMock).toHaveBeenCalledWith('automation-rule-run:job-1:rule-1', '1', 'EX', 3600, 'NX');
    expect(ticketsService.getSnapshotForAutomation).toHaveBeenCalledWith('ticket-1');
  });

  it('skips the rule when the claim is already held (stalled-job redelivery)', async () => {
    redisSetMock.mockResolvedValue(null);

    await service.runTrigger(AutomationTrigger.CLIENT_REPLIED, 'ticket-1', 'job-1');

    expect(ticketsService.getSnapshotForAutomation).not.toHaveBeenCalled();
  });

  it('runs the rule unconditionally when no jobId is available', async () => {
    await service.runTrigger(AutomationTrigger.CLIENT_REPLIED, 'ticket-1', undefined);

    expect(redisSetMock).not.toHaveBeenCalled();
    expect(ticketsService.getSnapshotForAutomation).toHaveBeenCalledWith('ticket-1');
  });
});
