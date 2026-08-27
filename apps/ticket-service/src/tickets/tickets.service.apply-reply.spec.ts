import { SYSTEM_USER_ID, TicketPriority, TicketStatus, TicketType } from '@veloxdesk/types';
import { TicketsService } from './tickets.service.js';

// Minimal TicketStatusEntity/TicketTypeEntity-shaped fixtures — only the
// fields the code paths under test actually read.
const OPEN_STATUS = { id: 'status-open', key: TicketStatus.OPEN, name: 'В работе', color: '#C2683F', isDefault: true, isClosed: false, tracksSla: true, sortOrder: 1 };
const SERVICE_REQUEST_TYPE = { id: 'type-service-request', key: TicketType.SERVICE_REQUEST, name: 'Запрос на обслуживание', color: '#4C82F7', isDefault: true, weight: 1, sortOrder: 2 };

function makeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-1',
    ticketNumber: 42,
    title: 'Тест',
    description: '',
    statusId: OPEN_STATUS.id,
    status: OPEN_STATUS,
    priority: TicketPriority.MEDIUM,
    typeId: SERVICE_REQUEST_TYPE.id,
    type: SERVICE_REQUEST_TYPE,
    createdBy: 'client-1',
    assignedTo: 'operator-1',
    teamId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('TicketsService.applyAutomatedReply', () => {
  let ticketsRepository: { findById: jest.Mock; findWatcherIds: jest.Mock };
  let usersRepository: { findOne: jest.Mock };
  let commentsRepository: { create: jest.Mock; save: jest.Mock };
  let notificationsProducer: { enqueue: jest.Mock };
  let ticketEventsPublisher: { publish: jest.Mock };
  let searchIndexProducer: { enqueueTicket: jest.Mock };
  let service: TicketsService;

  beforeEach(() => {
    ticketsRepository = { findById: jest.fn(), findWatcherIds: jest.fn().mockResolvedValue([]) };
    usersRepository = { findOne: jest.fn() };
    commentsRepository = {
      create: jest.fn((data) => data),
      save: jest.fn().mockResolvedValue({}),
    };
    notificationsProducer = { enqueue: jest.fn() };
    ticketEventsPublisher = { publish: jest.fn() };
    searchIndexProducer = { enqueueTicket: jest.fn() };

    service = new TicketsService(
      ticketsRepository as never,
      {} as never,
      notificationsProducer as never,
      ticketEventsPublisher as never,
      searchIndexProducer as never,
      {} as never,
      {} as never,
      {} as never,
      usersRepository as never,
      {} as never,
      commentsRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('falls back to SYSTEM_USER_ID as the author when the ticket has no assignee yet', async () => {
    ticketsRepository.findById.mockResolvedValue(makeTicket({ assignedTo: null }));
    usersRepository.findOne.mockImplementation(({ where: { id } }: { where: { id: string } }) =>
      Promise.resolve(
        id === 'client-1'
          ? { id: 'client-1', fullName: 'Иван Клиентов' }
          : { id: SYSTEM_USER_ID, fullName: 'Автоответчик' },
      ),
    );

    await service.applyAutomatedReply('ticket-1', 'Здравствуйте, {{client.fullName}}! — {{operator.fullName}}');

    expect(commentsRepository.create).toHaveBeenCalledWith({
      ticketId: 'ticket-1',
      authorId: SYSTEM_USER_ID,
      body: 'Здравствуйте, Иван Клиентов! — Автоответчик',
      isInternal: false,
    });
    expect(commentsRepository.save).toHaveBeenCalled();
    // The system account is permanently deactivated (soft-deleted) — a
    // plain findOne would miss it, so the author lookup must pass
    // withDeleted: true, unlike the real-assignee case.
    expect(usersRepository.findOne).toHaveBeenCalledWith({ where: { id: SYSTEM_USER_ID }, withDeleted: true });
    expect(notificationsProducer.enqueue).toHaveBeenCalledWith({
      type: 'reply',
      userId: 'client-1',
      ticketId: 'ticket-1',
    });
  });

  it('substitutes placeholders and posts a public reply from the assignee', async () => {
    ticketsRepository.findById.mockResolvedValue(makeTicket());
    usersRepository.findOne.mockImplementation(({ where: { id } }: { where: { id: string } }) =>
      Promise.resolve(
        id === 'client-1'
          ? { id: 'client-1', fullName: 'Иван Клиентов' }
          : { id: 'operator-1', fullName: 'Анна Операторова' },
      ),
    );

    await service.applyAutomatedReply(
      'ticket-1',
      'Здравствуйте, {{client.fullName}}! Ваш тикет #{{ticket.number}} принял {{operator.fullName}}.',
    );

    expect(commentsRepository.create).toHaveBeenCalledWith({
      ticketId: 'ticket-1',
      authorId: 'operator-1',
      body: 'Здравствуйте, Иван Клиентов! Ваш тикет #42 принял Анна Операторова.',
      isInternal: false,
    });
    expect(commentsRepository.save).toHaveBeenCalled();

    // Mirrors a human staff reply (chat.service.ts's postMessage) — the
    // client gets notified, not the operator who's credited as the author.
    expect(notificationsProducer.enqueue).toHaveBeenCalledWith({
      type: 'reply',
      userId: 'client-1',
      ticketId: 'ticket-1',
    });
    expect(ticketEventsPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'reply', ticketId: 'ticket-1', assignedTo: 'operator-1', createdBy: 'client-1' }),
    );
    expect(searchIndexProducer.enqueueTicket).toHaveBeenCalledWith('ticket-1');
  });

  it('falls back to an empty string for a placeholder whose user lookup misses', async () => {
    ticketsRepository.findById.mockResolvedValue(makeTicket());
    usersRepository.findOne.mockResolvedValue(null);

    await service.applyAutomatedReply('ticket-1', 'Hi {{client.fullName}}!');

    expect(commentsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Hi !' }),
    );
  });

  // Regression test: this path used to only ever notify ticket.createdBy —
  // a human reply (chat.service.ts's postMessage) also notifies every
  // watcher, but this one silently didn't, so a staff member (or client —
  // they can watch too) watching a ticket they don't own/aren't assigned
  // to missed every automated macro reply entirely.
  it('notifies every watcher too, excluding the ticket creator (already notified above)', async () => {
    ticketsRepository.findById.mockResolvedValue(makeTicket());
    ticketsRepository.findWatcherIds.mockResolvedValue(['watcher-1', 'client-1']);
    usersRepository.findOne.mockResolvedValue({ id: 'operator-1', fullName: 'Анна Операторова' });

    await service.applyAutomatedReply('ticket-1', 'Ответ');

    expect(notificationsProducer.enqueue).toHaveBeenCalledWith({
      type: 'reply',
      userId: 'watcher-1',
      ticketId: 'ticket-1',
    });
    expect(notificationsProducer.enqueue).toHaveBeenCalledTimes(2); // client-1 (recipient) + watcher-1, not client-1 twice
  });
});
