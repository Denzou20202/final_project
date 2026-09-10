import { JwtPayload } from '@veloxdesk/common';
import { TicketPriority, TicketStatus, TicketType, UserRole } from '@veloxdesk/types';
import { BadRequestException } from '@nestjs/common';
import { TicketsService } from './tickets.service.js';

// Minimal TicketStatusEntity/TicketTypeEntity-shaped fixtures — the real
// entities have more fields, but only these are ever read by the code paths
// under test.
const OPEN_STATUS = { id: 'status-open', key: TicketStatus.OPEN, name: 'В работе', color: '#C2683F', isDefault: true, isClosed: false, tracksSla: true, sortOrder: 1 };
const SERVICE_REQUEST_TYPE = { id: 'type-service-request', key: TicketType.SERVICE_REQUEST, name: 'Запрос на обслуживание', color: '#4C82F7', isDefault: true, weight: 1, sortOrder: 2 };

function makeTicket() {
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
    assignedTo: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeActor(): JwtPayload {
  return { sub: 'admin-1', email: 'admin@veloxdesk.local', role: UserRole.ADMIN };
}

describe('TicketsService.assign — cannotBeAssignee enforcement', () => {
  let ticketsRepository: { findById: jest.Mock };
  let usersRepository: { findOne: jest.Mock };
  let permissionGroupsRepository: { findOne: jest.Mock };
  let activityRepository: { log: jest.Mock };
  let notificationsProducer: { enqueue: jest.Mock };
  let ticketEventsPublisher: { publish: jest.Mock };
  let searchIndexProducer: { enqueueTicket: jest.Mock };
  // assign()'s DB write + activity log now happen inside
  // dataSource.transaction, which also takes a pessimistic_write lock on the
  // ticket row via createQueryBuilder(...).setLock(...).getOne() to capture
  // fromValue atomically — see tickets.service.ts.
  let manager: { update: jest.Mock; insert: jest.Mock; createQueryBuilder: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let service: TicketsService;

  beforeEach(() => {
    ticketsRepository = { findById: jest.fn().mockResolvedValue(makeTicket()) };
    usersRepository = { findOne: jest.fn() };
    permissionGroupsRepository = { findOne: jest.fn() };
    activityRepository = { log: jest.fn() };
    notificationsProducer = { enqueue: jest.fn() };
    ticketEventsPublisher = { publish: jest.fn() };
    searchIndexProducer = { enqueueTicket: jest.fn() };
    manager = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      insert: jest.fn().mockResolvedValue({ identifiers: [{}] }),
      createQueryBuilder: jest.fn().mockReturnValue({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(makeTicket()),
      }),
    };
    dataSource = { transaction: jest.fn((cb: (manager: unknown) => Promise<unknown>) => cb(manager)) };

    service = new TicketsService(
      ticketsRepository as never,
      activityRepository as never,
      notificationsProducer as never,
      ticketEventsPublisher as never,
      searchIndexProducer as never,
      {} as never,
      {} as never,
      dataSource as never,
      usersRepository as never,
      {} as never,
      {} as never,
      permissionGroupsRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('rejects assigning to a member of a cannotBeAssignee group', async () => {
    usersRepository.findOne.mockResolvedValue({ id: 'user-1', role: UserRole.OPERATOR, permissionGroupId: 'group-1' });
    permissionGroupsRepository.findOne.mockResolvedValue({ id: 'group-1', cannotBeAssignee: true });

    await expect(service.assign('ticket-1', { assigneeId: 'user-1' }, makeActor())).rejects.toThrow(
      BadRequestException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('allows assigning to a member of a group without cannotBeAssignee', async () => {
    usersRepository.findOne.mockResolvedValue({ id: 'user-1', role: UserRole.OPERATOR, permissionGroupId: 'group-1' });
    permissionGroupsRepository.findOne.mockResolvedValue({ id: 'group-1', cannotBeAssignee: false });

    await service.assign('ticket-1', { assigneeId: 'user-1' }, makeActor());
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), { id: 'ticket-1' }, { assignedTo: 'user-1' });
  });

  it('allows assigning to a user with no group at all', async () => {
    usersRepository.findOne.mockResolvedValue({ id: 'user-1', role: UserRole.OPERATOR, permissionGroupId: null });

    await service.assign('ticket-1', { assigneeId: 'user-1' }, makeActor());
    expect(permissionGroupsRepository.findOne).not.toHaveBeenCalled();
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), { id: 'ticket-1' }, { assignedTo: 'user-1' });
  });
});
