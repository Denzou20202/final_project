import { TicketActivityEntity, TicketEntity } from '@veloxdesk/database';
import { TicketActivityType, UserRole } from '@veloxdesk/types';
import { IsNull } from 'typeorm';
import { ChatService } from './chat.service.js';

describe('ChatService.postMessage — auto-assign unassigned ticket on operator reply', () => {
  let mockQueryBuilder: { setLock: jest.Mock; where: jest.Mock; getOne: jest.Mock };
  let mockManager: { getRepository: jest.Mock; update: jest.Mock; insert: jest.Mock };
  let ticketsRepository: { manager: { transaction: jest.Mock } };
  let commentsRepository: { create: jest.Mock; save: jest.Mock };
  let service: ChatService;

  beforeEach(() => {
    mockQueryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 'ticket-1', assignedTo: null }),
    };
    mockManager = {
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      insert: jest.fn().mockResolvedValue({}),
    };
    ticketsRepository = {
      manager: {
        transaction: jest.fn(async (cb) => cb(mockManager)),
      },
    };
    commentsRepository = {
      create: jest.fn((d) => d),
      save: jest.fn().mockResolvedValue({ id: 'comment-1' }),
    };

    service = new ChatService(
      ticketsRepository as never,
      commentsRepository as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      { createQueryBuilder: jest.fn() } as never,
      {} as never,
      { findOne: jest.fn().mockResolvedValue({ id: 'client-1', profileCompletedAt: new Date() }) } as never,
      { enqueue: jest.fn() } as never,
      { enqueue: jest.fn() } as never,
      { relay: jest.fn() } as never,
    );
  });

  it('auto-assigns unassigned ticket to replying operator and creates ASSIGNED activity under transaction', async () => {
    const ticket: any = {
      id: 'ticket-1',
      ticketNumber: 42,
      title: 'Не работает принтер',
      status: { isClosed: false },
      deletedAt: null,
      createdBy: 'client-1',
      assignedTo: null,
    };
    const actor = { sub: 'operator-1', email: 'op@veloxdesk.local', role: UserRole.OPERATOR };

    await service.postMessage(ticket, actor as never, '<p>Беру в работу</p>', false);

    expect(ticketsRepository.manager.transaction).toHaveBeenCalled();
    expect(mockQueryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(mockManager.update).toHaveBeenCalledWith(
      TicketEntity,
      { id: 'ticket-1', assignedTo: IsNull() },
      { assignedTo: 'operator-1' },
    );
    expect(mockManager.insert).toHaveBeenCalledWith(TicketActivityEntity, {
      ticketId: 'ticket-1',
      actorId: 'operator-1',
      type: TicketActivityType.ASSIGNED,
      fromValue: null,
      toValue: 'operator-1',
    });
    expect(ticket.assignedTo).toBe('operator-1');
  });

  it('does NOT reassign if ticket is already assigned', async () => {
    const ticket: any = {
      id: 'ticket-1',
      ticketNumber: 42,
      title: 'Не работает принтер',
      status: { isClosed: false },
      deletedAt: null,
      createdBy: 'client-1',
      assignedTo: 'operator-2',
    };
    const actor = { sub: 'operator-1', email: 'op@veloxdesk.local', role: UserRole.OPERATOR };

    await service.postMessage(ticket, actor as never, '<p>Подключаюсь</p>', false);

    expect(ticketsRepository.manager.transaction).not.toHaveBeenCalled();
    expect(ticket.assignedTo).toBe('operator-2');
  });

  it('does NOT assign if locked ticket in DB is already assigned', async () => {
    const ticket: any = {
      id: 'ticket-1',
      ticketNumber: 42,
      title: 'Не работает принтер',
      status: { isClosed: false },
      deletedAt: null,
      createdBy: 'client-1',
      assignedTo: null,
    };
    mockQueryBuilder.getOne.mockResolvedValueOnce({ id: 'ticket-1', assignedTo: 'operator-3' });
    const actor = { sub: 'operator-1', email: 'op@veloxdesk.local', role: UserRole.OPERATOR };

    await service.postMessage(ticket, actor as never, '<p>Беру в работу</p>', false);

    expect(ticketsRepository.manager.transaction).toHaveBeenCalled();
    expect(mockManager.update).not.toHaveBeenCalled();
    expect(mockManager.insert).not.toHaveBeenCalled();
    expect(ticket.assignedTo).toBeNull();
  });

  it('does NOT assign if actor is client', async () => {
    const ticket: any = {
      id: 'ticket-1',
      ticketNumber: 42,
      title: 'Не работает принтер',
      status: { isClosed: false },
      deletedAt: null,
      createdBy: 'client-1',
      assignedTo: null,
    };
    const actor = { sub: 'client-1', email: 'client@veloxdesk.local', role: UserRole.CLIENT };

    await service.postMessage(ticket, actor as never, '<p>Уточнение</p>', false);

    expect(ticketsRepository.manager.transaction).not.toHaveBeenCalled();
    expect(ticket.assignedTo).toBeNull();
  });
});
