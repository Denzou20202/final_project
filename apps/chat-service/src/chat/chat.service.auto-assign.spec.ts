import { TicketActivityType, UserRole } from '@veloxdesk/types';
import { IsNull } from 'typeorm';
import { ChatService } from './chat.service.js';

describe('ChatService.postMessage — auto-assign unassigned ticket on operator reply', () => {
  let ticketsRepository: { update: jest.Mock };
  let activityRepository: { insert: jest.Mock };
  let commentsRepository: { create: jest.Mock; save: jest.Mock };
  let service: ChatService;

  beforeEach(() => {
    ticketsRepository = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
    activityRepository = { insert: jest.fn().mockResolvedValue({}) };
    commentsRepository = {
      create: jest.fn((d) => d),
      save: jest.fn().mockResolvedValue({ id: 'comment-1' }),
    };

    service = new ChatService(
      ticketsRepository as never,
      commentsRepository as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      { createQueryBuilder: jest.fn() } as never,
      activityRepository as never,
      { findOne: jest.fn().mockResolvedValue({ id: 'client-1', profileCompletedAt: new Date() }) } as never,
      { enqueue: jest.fn() } as never,
      { enqueue: jest.fn() } as never,
      { relay: jest.fn() } as never,
    );
  });

  it('auto-assigns unassigned ticket to replying operator and creates ASSIGNED activity', async () => {
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

    expect(ticketsRepository.update).toHaveBeenCalledWith(
      { id: 'ticket-1', assignedTo: IsNull() },
      { assignedTo: 'operator-1' },
    );
    expect(activityRepository.insert).toHaveBeenCalledWith({
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

    expect(ticketsRepository.update).not.toHaveBeenCalled();
    expect(activityRepository.insert).not.toHaveBeenCalled();
    expect(ticket.assignedTo).toBe('operator-2');
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

    expect(ticketsRepository.update).not.toHaveBeenCalled();
    expect(activityRepository.insert).not.toHaveBeenCalled();
    expect(ticket.assignedTo).toBeNull();
  });
});
