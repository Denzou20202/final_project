import { JwtPayload } from '@veloxdesk/common';
import { SortOrder, TicketSortField, TicketStatus, TicketType, UserRole } from '@veloxdesk/types';
import { TicketsRepository } from './tickets.repository.js';
import { TicketsService } from './tickets.service.js';

// Minimal TicketStatusEntity/TicketTypeEntity-shaped fixtures — only the
// fields the code paths under test actually read.
const OPEN_STATUS = { id: 'status-open', key: TicketStatus.OPEN, name: 'В работе', color: '#C2683F', isDefault: true, isClosed: false, tracksSla: true, sortOrder: 1 };
const SERVICE_REQUEST_TYPE = { id: 'type-service-request', key: TicketType.SERVICE_REQUEST, name: 'Запрос на обслуживание', color: '#4C82F7', isDefault: true, weight: 1, sortOrder: 2 };

function makeActor(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return { sub: 'operator-1', email: 'op@veloxdesk.local', role: UserRole.OPERATOR, ...overrides };
}

// Only list()/getCounts() are under test — every other constructor
// dependency is a stub that's never called from those two methods.
function makeService(ticketsRepository: Partial<TicketsRepository>) {
  const noop = {} as never;
  return new TicketsService(
    ticketsRepository as TicketsRepository,
    noop,
    noop,
    noop,
    noop,
    noop,
    noop,
    noop,
    noop,
    noop,
    noop,
    noop,
    noop,
    noop,
    noop,
    noop,
    noop,
    noop,
  );
}

describe('TicketsService restriction filters', () => {
  let findPage: jest.Mock;
  let getCounts: jest.Mock;
  let service: TicketsService;

  beforeEach(() => {
    findPage = jest.fn().mockResolvedValue([]);
    getCounts = jest.fn().mockResolvedValue({});
    service = makeService({ findPage, getCounts } as never);
  });

  const query = { sortBy: TicketSortField.CREATED_AT, sortOrder: SortOrder.DESC };

  it('applies no restriction fields for an actor with no group', async () => {
    await service.list(query as never, makeActor());
    const filters = findPage.mock.calls[0][1];
    expect(filters.restrictDepartmentIds).toBeUndefined();
    expect(filters.restrictToUserId).toBeUndefined();
  });

  it('restricts to own tickets when restrictToOwnTickets is set', async () => {
    await service.list(query as never, makeActor({ restrictToOwnTickets: true }));
    const filters = findPage.mock.calls[0][1];
    expect(filters.restrictToUserId).toBe('operator-1');
    expect(filters.restrictDepartmentIds).toBeUndefined();
  });

  it('restricts to department ids when restrictToDepartments is set', async () => {
    await service.list(query as never, makeActor({ restrictToDepartments: true, departmentIds: ['team-1', 'team-2'] }));
    const filters = findPage.mock.calls[0][1];
    expect(filters.restrictDepartmentIds).toEqual(['team-1', 'team-2']);
    expect(filters.restrictToUserId).toBeUndefined();
  });

  it('passes an empty array (not undefined) when restricted to zero departments', async () => {
    await service.list(query as never, makeActor({ restrictToDepartments: true, departmentIds: [] }));
    const filters = findPage.mock.calls[0][1];
    expect(filters.restrictDepartmentIds).toEqual([]);
  });

  it('combines both restrictions when both toggles are on', async () => {
    await service.list(
      query as never,
      makeActor({ restrictToDepartments: true, departmentIds: ['team-1'], restrictToOwnTickets: true }),
    );
    const filters = findPage.mock.calls[0][1];
    expect(filters.restrictDepartmentIds).toEqual(['team-1']);
    expect(filters.restrictToUserId).toBe('operator-1');
  });

  it('never restricts a client — they are already scoped by createdBy alone', async () => {
    await service.list(
      query as never,
      makeActor({ role: UserRole.CLIENT, restrictToDepartments: true, restrictToOwnTickets: true }),
    );
    const filters = findPage.mock.calls[0][1];
    expect(filters.createdBy).toBe('operator-1');
    expect(filters.restrictDepartmentIds).toBeUndefined();
    expect(filters.restrictToUserId).toBeUndefined();
  });

  it('applies the same restrictions to getCounts', async () => {
    await service.getCounts({} as never, makeActor({ restrictToOwnTickets: true }));
    const filters = getCounts.mock.calls[0][0];
    expect(filters.restrictToUserId).toBe('operator-1');
  });
});

describe('TicketsService.getCountsByTeam / getCountsByTag — batched sidebar counts', () => {
  let getCountsByTeam: jest.Mock;
  let getCountsByTag: jest.Mock;
  let getUnassignedCountsByTeam: jest.Mock;
  let getCountsByTeamAndAssignee: jest.Mock;
  let service: TicketsService;

  beforeEach(() => {
    getCountsByTeam = jest.fn().mockResolvedValue({
      'team-1': { open: 2, pending: 1, resolved: 0, closed: 0 },
    });
    getCountsByTag = jest.fn().mockResolvedValue({
      'tag-1': { open: 0, pending: 1, resolved: 0, closed: 0 },
    });
    getUnassignedCountsByTeam = jest.fn().mockResolvedValue({ 'team-1': 1 });
    getCountsByTeamAndAssignee = jest.fn().mockResolvedValue({});
    service = makeService({
      getCountsByTeam,
      getCountsByTag,
      getUnassignedCountsByTeam,
      getCountsByTeamAndAssignee,
    } as never);
  });

  it('makes a single repository call regardless of how many teams exist', async () => {
    const result = await service.getCountsByTeam(makeActor());

    expect(getCountsByTeam).toHaveBeenCalledTimes(1);
    expect(result['team-1']).toEqual({
      total: 3,
      byStatus: { open: 2, pending: 1, resolved: 0, closed: 0 },
      unassigned: 1,
      byAssignee: {},
    });
  });

  it('makes a single repository call regardless of how many tags exist', async () => {
    const result = await service.getCountsByTag(makeActor());

    expect(getCountsByTag).toHaveBeenCalledTimes(1);
    expect(result['tag-1']).toEqual({ total: 1, byStatus: { open: 0, pending: 1, resolved: 0, closed: 0 } });
  });

  it('applies the same permission-group restrictions as getCounts', async () => {
    await service.getCountsByTeam(makeActor({ restrictToOwnTickets: true }));
    expect(getCountsByTeam).toHaveBeenCalledWith(expect.objectContaining({ restrictToUserId: 'operator-1' }));
  });
});

// The by-id twin of the list restrictions above — a restricted operator
// must get the same 404 for a direct UUID that the list would have hidden.
describe('TicketsService single-ticket access under restrictions', () => {
  const ticket = {
    id: 'ticket-1',
    createdBy: 'client-1',
    assignedTo: 'operator-2',
    teamId: 'team-1',
    statusId: OPEN_STATUS.id,
    status: OPEN_STATUS,
    typeId: SERVICE_REQUEST_TYPE.id,
    type: SERVICE_REQUEST_TYPE,
  };
  let findById: jest.Mock;
  let hasMention: jest.Mock;
  let service: TicketsService;

  beforeEach(() => {
    findById = jest.fn().mockResolvedValue(ticket);
    // Every "not in scope" case below now also falls through to a mention
    // check before 404ing — false by default, individual tests override it.
    hasMention = jest.fn().mockResolvedValue(false);
    // findOne() reads via findByIdIncludingDeleted (so a trashed ticket
    // still resolves) — same mock function so a later
    // findById.mockResolvedValue(...) in a test still affects both.
    service = makeService({ findById, findByIdIncludingDeleted: findById, hasMention } as never);
  });

  it('lets an unrestricted operator open any ticket', async () => {
    await expect(service.findOne('ticket-1', makeActor())).resolves.toMatchObject({ id: 'ticket-1' });
  });

  it('404s a department-restricted operator on a ticket from another department', async () => {
    await expect(
      service.findOne('ticket-1', makeActor({ restrictToDepartments: true, departmentIds: ['team-2'] })),
    ).rejects.toThrow('Ticket not found');
  });

  it('404s a department-restricted operator on a ticket with no department at all', async () => {
    findById.mockResolvedValue({ ...ticket, teamId: null });
    await expect(
      service.findOne('ticket-1', makeActor({ restrictToDepartments: true, departmentIds: ['team-1'] })),
    ).rejects.toThrow('Ticket not found');
  });

  it('allows a department-restricted operator on a ticket from their department', async () => {
    await expect(
      service.findOne('ticket-1', makeActor({ restrictToDepartments: true, departmentIds: ['team-1'] })),
    ).resolves.toMatchObject({ id: 'ticket-1' });
  });

  it('404s an own-tickets-only operator on a ticket assigned to someone else', async () => {
    await expect(service.findOne('ticket-1', makeActor({ restrictToOwnTickets: true }))).rejects.toThrow(
      'Ticket not found',
    );
  });

  it('allows an own-tickets-only operator on a ticket assigned to them', async () => {
    findById.mockResolvedValue({ ...ticket, assignedTo: 'operator-1' });
    await expect(service.findOne('ticket-1', makeActor({ restrictToOwnTickets: true }))).resolves.toMatchObject({
      id: 'ticket-1',
    });
  });

  it('still scopes clients to their own tickets', async () => {
    await expect(
      service.findOne('ticket-1', makeActor({ role: UserRole.CLIENT, sub: 'client-2' })),
    ).rejects.toThrow('Ticket not found');
    await expect(
      service.findOne('ticket-1', makeActor({ role: UserRole.CLIENT, sub: 'client-1' })),
    ).resolves.toMatchObject({ id: 'ticket-1' });
  });

  // The @mention exception — a department-restricted operator who was
  // @mentioned on this ticket gets full access despite being out of scope.
  it('allows a department-restricted operator on an out-of-department ticket they were @mentioned on', async () => {
    hasMention.mockResolvedValue(true);
    await expect(
      service.findOne('ticket-1', makeActor({ restrictToDepartments: true, departmentIds: ['team-2'] })),
    ).resolves.toMatchObject({ id: 'ticket-1' });
    expect(hasMention).toHaveBeenCalledWith('ticket-1', 'operator-1');
  });

  it('still 404s a department-restricted operator who was not @mentioned', async () => {
    hasMention.mockResolvedValue(false);
    await expect(
      service.findOne('ticket-1', makeActor({ restrictToDepartments: true, departmentIds: ['team-2'] })),
    ).rejects.toThrow('Ticket not found');
  });

  it('does not even check for a mention when the actor already has normal access', async () => {
    await expect(
      service.findOne('ticket-1', makeActor({ restrictToDepartments: true, departmentIds: ['team-1'] })),
    ).resolves.toMatchObject({ id: 'ticket-1' });
    expect(hasMention).not.toHaveBeenCalled();
  });

  it('never checks mentions for a client', async () => {
    await expect(
      service.findOne('ticket-1', makeActor({ role: UserRole.CLIENT, sub: 'client-2' })),
    ).rejects.toThrow('Ticket not found');
    expect(hasMention).not.toHaveBeenCalled();
  });
});

// The list/counts twin of the @mention access exception above — unlike
// Watching, this filter must bypass restrictDepartmentIds/restrictToUserId
// entirely, since surfacing tickets OUTSIDE the operator's normal scope is
// the whole point of the folder.
describe('TicketsService list/getCounts — mentioned=me bypasses department restrictions', () => {
  let findPage: jest.Mock;
  let getCounts: jest.Mock;
  let service: TicketsService;

  beforeEach(() => {
    findPage = jest.fn().mockResolvedValue([]);
    getCounts = jest.fn().mockResolvedValue({});
    service = makeService({ findPage, getCounts } as never);
  });

  const restrictedActor = makeActor({ restrictToDepartments: true, departmentIds: ['team-1'] });

  it('resolves mentioned=me to the actor id and drops restrictDepartmentIds/restrictToUserId', async () => {
    await service.list(
      { mentioned: 'me', sortBy: TicketSortField.CREATED_AT, sortOrder: SortOrder.DESC } as never,
      restrictedActor,
    );
    const filters = findPage.mock.calls[0][1];
    expect(filters.mentionedId).toBe('operator-1');
    expect(filters.restrictDepartmentIds).toBeUndefined();
    expect(filters.restrictToUserId).toBeUndefined();
  });

  it('keeps the normal department restriction when mentioned is not requested', async () => {
    await service.list(
      { sortBy: TicketSortField.CREATED_AT, sortOrder: SortOrder.DESC } as never,
      restrictedActor,
    );
    const filters = findPage.mock.calls[0][1];
    expect(filters.mentionedId).toBeUndefined();
    expect(filters.restrictDepartmentIds).toEqual(['team-1']);
  });

  it('applies the same mentioned=me bypass to getCounts', async () => {
    await service.getCounts({ mentioned: 'me' } as never, restrictedActor);
    const filters = getCounts.mock.calls[0][0];
    expect(filters.mentionedId).toBe('operator-1');
    expect(filters.restrictDepartmentIds).toBeUndefined();
  });
});
