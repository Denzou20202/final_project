import { UserRole } from '@veloxdesk/types';
import { NotFoundException } from '@nestjs/common';
import { CsatService } from './csat.service.js';

function makeActor(overrides: Record<string, unknown> = {}) {
  return { sub: 'operator-1', email: 'op@veloxdesk.local', role: UserRole.OPERATOR, ...overrides };
}

const outOfScopeTicket = { id: 'ticket-1', createdBy: 'client-1', assignedTo: null, teamId: 'team-2', status: { isClosed: true } };

describe('CsatService.getSurvey — @mention access exception', () => {
  let ticketsRepository: { findOne: jest.Mock };
  let mentionsRepository: { count: jest.Mock };
  let csatRepository: { findSurveyByTicketId: jest.Mock };
  let service: CsatService;

  beforeEach(() => {
    ticketsRepository = { findOne: jest.fn().mockResolvedValue(outOfScopeTicket) };
    mentionsRepository = { count: jest.fn().mockResolvedValue(0) };
    csatRepository = { findSurveyByTicketId: jest.fn().mockResolvedValue(null) };

    service = new CsatService(
      csatRepository as never,
      {} as never, // questionsRepository
      ticketsRepository as never,
      {} as never, // activityRepository
      mentionsRepository as never,
      {} as never, // dataSource
    );
  });

  it('404s a department-restricted operator who was never mentioned', async () => {
    await expect(
      service.getSurvey('ticket-1', makeActor({ restrictToDepartments: true, departmentIds: ['team-1'] })),
    ).rejects.toThrow(NotFoundException);
  });

  it('allows a department-restricted operator who was @mentioned on this ticket', async () => {
    mentionsRepository.count.mockResolvedValue(1);
    await expect(
      service.getSurvey('ticket-1', makeActor({ restrictToDepartments: true, departmentIds: ['team-1'] })),
    ).resolves.toEqual({ status: 'not_available' });
  });
});
