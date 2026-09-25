import { TicketActivityType } from '@veloxdesk/types';
import { SlaEscalationService } from './sla-escalation.service.js';

describe('SlaEscalationService', () => {
  let service: SlaEscalationService;
  let slaEscalationRepository: {
    findResponseBreachCandidates: jest.Mock;
    findResolutionBreachCandidates: jest.Mock;
  };
  let activityRepository: {
    existsOfType: jest.Mock;
  };
  let ticketsService: {
    applySlaEscalation: jest.Mock;
  };

  beforeEach(() => {
    slaEscalationRepository = {
      findResponseBreachCandidates: jest.fn().mockResolvedValue([]),
      findResolutionBreachCandidates: jest.fn().mockResolvedValue([]),
    };
    activityRepository = {
      existsOfType: jest.fn().mockResolvedValue(false),
    };
    ticketsService = {
      applySlaEscalation: jest.fn().mockResolvedValue(undefined),
    };

    service = new SlaEscalationService(
      slaEscalationRepository as never,
      activityRepository as never,
      ticketsService as never,
    );
  });

  it('escalates response SLA breach candidates returned by repository without N+1 loops', async () => {
    slaEscalationRepository.findResponseBreachCandidates.mockResolvedValue([
      { id: 'ticket-1', createdBy: 'user-1' },
      { id: 'ticket-2', createdBy: 'user-2' },
    ]);

    await service.checkSlaBreaches();

    expect(ticketsService.applySlaEscalation).toHaveBeenCalledWith(
      'ticket-1',
      TicketActivityType.SLA_RESPONSE_BREACHED,
    );
    expect(ticketsService.applySlaEscalation).toHaveBeenCalledWith(
      'ticket-2',
      TicketActivityType.SLA_RESPONSE_BREACHED,
    );
  });

  it('escalates resolution SLA breach candidates returned by repository', async () => {
    slaEscalationRepository.findResolutionBreachCandidates.mockResolvedValue([
      { id: 'ticket-3', createdBy: 'user-3' },
    ]);

    await service.checkSlaBreaches();

    expect(ticketsService.applySlaEscalation).toHaveBeenCalledWith(
      'ticket-3',
      TicketActivityType.SLA_RESOLUTION_BREACHED,
    );
  });

  it('does not let one failing escalation abort remaining candidates', async () => {
    slaEscalationRepository.findResponseBreachCandidates.mockResolvedValue([
      { id: 'bad-ticket', createdBy: 'user-1' },
      { id: 'good-ticket', createdBy: 'user-2' },
    ]);

    ticketsService.applySlaEscalation.mockImplementation((id: string) => {
      if (id === 'bad-ticket') throw new Error('Invalid priority');
      return Promise.resolve();
    });

    await service.checkSlaBreaches();

    expect(ticketsService.applySlaEscalation).toHaveBeenCalledWith(
      'good-ticket',
      TicketActivityType.SLA_RESPONSE_BREACHED,
    );
  });
});
