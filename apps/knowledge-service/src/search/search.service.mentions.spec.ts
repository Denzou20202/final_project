import { TicketPriority, UserRole } from '@veloxdesk/types';
import { SearchService } from './search.service.js';

function makeActor(overrides: Record<string, unknown> = {}) {
  return { sub: 'operator-1', email: 'op@veloxdesk.local', role: UserRole.OPERATOR, ...overrides };
}

function makeHit(id: string) {
  return {
    id,
    source: {
      title: 'Тест',
      description: '',
      status: 'status-open',
      priority: TicketPriority.MEDIUM,
      createdBy: 'client-1',
      assignedTo: null,
      createdAt: new Date().toISOString(),
    },
    score: 1,
    highlight: {},
  };
}

describe('SearchService.searchTickets — @mention access exception', () => {
  let elasticsearch: { search: jest.Mock };
  let ticketsRepository: { find: jest.Mock };
  let mentionsRepository: { find: jest.Mock };
  let service: SearchService;

  beforeEach(() => {
    elasticsearch = { search: jest.fn().mockResolvedValue([makeHit('mentioned-1'), makeHit('other-1')]) };
    // Both hits belong to team-2, out of a team-1-restricted actor's scope.
    ticketsRepository = {
      find: jest.fn().mockResolvedValue([
        { id: 'mentioned-1', createdBy: 'client-1', assignedTo: null, teamId: 'team-2' },
        { id: 'other-1', createdBy: 'client-1', assignedTo: null, teamId: 'team-2' },
      ]),
    };
    mentionsRepository = { find: jest.fn().mockResolvedValue([{ ticketId: 'mentioned-1' }]) };

    service = new SearchService(elasticsearch as never, ticketsRepository as never, mentionsRepository as never);
  });

  it('includes a mentioned out-of-department hit but excludes an unmentioned one', async () => {
    const results = await service.searchTickets(
      makeActor({ restrictToDepartments: true, departmentIds: ['team-1'] }),
      'query',
    );
    expect(results.map((r) => r.id)).toEqual(['mentioned-1']);
  });

  it('runs a single batched mentions query, not one per hit', async () => {
    await service.searchTickets(makeActor({ restrictToDepartments: true, departmentIds: ['team-1'] }), 'query');
    expect(mentionsRepository.find).toHaveBeenCalledTimes(1);
  });

  it('skips both extra queries for an unrestricted actor', async () => {
    await service.searchTickets(makeActor(), 'query');
    expect(ticketsRepository.find).not.toHaveBeenCalled();
    expect(mentionsRepository.find).not.toHaveBeenCalled();
  });
});
