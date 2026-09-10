import { JwtPayload } from '@veloxdesk/common';
import { TicketPriority, TicketStatus, TicketType, UserRole } from '@veloxdesk/types';
import { TicketsService } from './tickets.service.js';

// Minimal TicketStatusEntity-shaped fixtures — only the fields updateStatus
// actually reads (id/key/name/isDefault/isClosed).
const OPEN_STATUS = { id: 'status-open', key: TicketStatus.OPEN, name: 'В работе', color: '#C2683F', isDefault: true, isClosed: false, tracksSla: true, sortOrder: 1 };
const PENDING_STATUS = { id: 'status-pending', key: TicketStatus.PENDING, name: 'Ожидание', color: '#E6A817', isDefault: false, isClosed: false, tracksSla: true, sortOrder: 2 };
const RESOLVED_STATUS = { id: 'status-resolved', key: TicketStatus.RESOLVED, name: 'Передано разработчикам', color: '#5B8A72', isDefault: false, isClosed: false, tracksSla: false, sortOrder: 3 };
const STATUSES_BY_ID: Record<string, typeof OPEN_STATUS> = {
  [OPEN_STATUS.id]: OPEN_STATUS,
  [PENDING_STATUS.id]: PENDING_STATUS,
  [RESOLVED_STATUS.id]: RESOLVED_STATUS,
};
const SERVICE_REQUEST_TYPE = { id: 'type-service-request', key: TicketType.SERVICE_REQUEST, name: 'Запрос на обслуживание', color: '#4C82F7', isDefault: true, weight: 1, sortOrder: 2 };

function makeTicket(overrides: Partial<ReturnType<typeof baseTicket>> = {}) {
  return { ...baseTicket(), ...overrides };
}

function baseTicket() {
  return {
    id: 'ticket-1',
    ticketNumber: 1,
    title: 'Тест',
    description: '',
    statusId: OPEN_STATUS.id,
    status: OPEN_STATUS,
    priority: TicketPriority.MEDIUM,
    typeId: SERVICE_REQUEST_TYPE.id,
    type: SERVICE_REQUEST_TYPE,
    createdBy: 'client-1',
    assignedTo: null as string | null,
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeActor(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return { sub: 'operator-1', email: 'operator@veloxdesk.local', role: UserRole.OPERATOR, ...overrides };
}

describe('TicketsService.updateStatus — self-assign on pickup', () => {
  let ticketsRepository: { findById: jest.Mock };
  let activityRepository: { log: jest.Mock };
  let searchIndexProducer: { enqueueTicket: jest.Mock };
  let automationTriggerProducer: { enqueue: jest.Mock };
  let ticketEventsPublisher: { publish: jest.Mock };
  let ticketStatusesRepository: { findById: jest.Mock };
  // Everything inside updateStatus's transaction now goes through
  // dataSource.transaction's manager (update/insert/createQueryBuilder),
  // not the repositories above — see tickets.service.ts's updateStatus for
  // why (row-locked re-read + self-assign + status write + both activity
  // logs must commit atomically).
  let manager: { update: jest.Mock; insert: jest.Mock; createQueryBuilder: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let service: TicketsService;

  function build(ticket: ReturnType<typeof makeTicket>) {
    ticketsRepository = {
      findById: jest.fn().mockResolvedValue(ticket),
    };
    activityRepository = { log: jest.fn() };
    searchIndexProducer = { enqueueTicket: jest.fn() };
    automationTriggerProducer = { enqueue: jest.fn() };
    ticketEventsPublisher = { publish: jest.fn() };
    ticketStatusesRepository = { findById: jest.fn((id: string) => Promise.resolve(STATUSES_BY_ID[id])) };
    manager = {
      // Mirrors the real repository's CAS: succeeds unless a test overrides
      // it — every ticket these tests build starts unassigned, so the
      // self-assign UPDATE (when attempted) affects a row by default.
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      insert: jest.fn().mockResolvedValue({ identifiers: [{}] }),
      // Row lock re-read at the top of the transaction — resolves to the
      // same fixture the pre-transaction read above got, since these tests
      // aren't exercising the concurrency the lock actually guards against.
      createQueryBuilder: jest.fn().mockReturnValue({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(ticket),
      }),
    };
    dataSource = { transaction: jest.fn((cb: (manager: unknown) => Promise<unknown>) => cb(manager)) };

    service = new TicketsService(
      ticketsRepository as never,
      activityRepository as never,
      {} as never,
      ticketEventsPublisher as never,
      searchIndexProducer as never,
      {} as never,
      automationTriggerProducer as never,
      dataSource as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      ticketStatusesRepository as never,
      {} as never,
      {} as never,
    );
  }

  it('assigns the acting operator when picking up an unassigned open ticket', async () => {
    build(makeTicket({ statusId: OPEN_STATUS.id, status: OPEN_STATUS, assignedTo: null }));
    const actor = makeActor();

    await service.updateStatus('ticket-1', { statusId: PENDING_STATUS.id }, actor);

    expect(manager.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'ticket-1' }), {
      assignedTo: 'operator-1',
    });
    expect(manager.insert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'assigned', fromValue: null, toValue: 'operator-1' }),
    );
  });

  it('does not reassign a ticket that already has an assignee', async () => {
    build(makeTicket({ statusId: OPEN_STATUS.id, status: OPEN_STATUS, assignedTo: 'someone-else' }));

    await service.updateStatus('ticket-1', { statusId: PENDING_STATUS.id }, makeActor());

    expect(manager.insert).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'assigned' }));
  });

  it('assigns the acting operator when reopening an unassigned resolved/closed ticket', async () => {
    build(makeTicket({ statusId: RESOLVED_STATUS.id, status: RESOLVED_STATUS, assignedTo: null }));

    await service.updateStatus('ticket-1', { statusId: OPEN_STATUS.id }, makeActor());

    expect(manager.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'ticket-1' }), {
      assignedTo: 'operator-1',
    });
  });

  it('does not self-assign an actor whose permission group cannot be an assignee', async () => {
    build(makeTicket({ statusId: OPEN_STATUS.id, status: OPEN_STATUS, assignedTo: null }));

    await service.updateStatus('ticket-1', { statusId: PENDING_STATUS.id }, makeActor({ cannotBeAssignee: true }));

    expect(manager.insert).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'assigned' }));
  });

  it('skips logging the ASSIGNED activity when a concurrent request already won the self-assign race', async () => {
    build(makeTicket({ statusId: OPEN_STATUS.id, status: OPEN_STATUS, assignedTo: null }));
    // First manager.update call is the self-assign CAS; losing it should not
    // stop the status-change update that follows in the same transaction.
    manager.update.mockResolvedValueOnce({ affected: 0 });

    await service.updateStatus('ticket-1', { statusId: PENDING_STATUS.id }, makeActor());

    expect(manager.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'ticket-1' }), {
      assignedTo: 'operator-1',
    });
    expect(manager.insert).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ type: 'assigned' }));
  });
});
