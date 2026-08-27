import { Locale, TicketStatus, UserRole } from '@veloxdesk/types';
import { ChatService } from './chat.service.js';

describe('ChatService.postMessage — Telegram relay locale', () => {
  let usersRepository: { findOne: jest.Mock };
  let telegramOutbound: { relay: jest.Mock };
  let service: ChatService;

  beforeEach(() => {
    usersRepository = { findOne: jest.fn() };
    telegramOutbound = { relay: jest.fn() };

    service = new ChatService(
      {} as never, // ticketsRepository
      { create: jest.fn((d) => d), save: jest.fn().mockResolvedValue({ id: 'comment-1' }) } as never, // commentsRepository
      { find: jest.fn().mockResolvedValue([]) } as never, // watchersRepository
      { createQueryBuilder: jest.fn() } as never, // mentionsRepository
      {} as never, // activityRepository
      usersRepository as never,
      { enqueue: jest.fn() } as never, // notificationsProducer
      { enqueue: jest.fn() } as never, // automationTriggerProducer
      telegramOutbound as never,
    );
  });

  it("labels the live-forwarded ticket button in the client's own locale, not Russian", async () => {
    usersRepository.findOne.mockResolvedValue({ id: 'client-1', locale: Locale.EN, telegramChatId: '999' });
    const ticket = {
      id: 'ticket-1',
      ticketNumber: 7,
      title: 'Не работает принтер',
      status: TicketStatus.OPEN,
      deletedAt: null,
      createdBy: 'client-1',
      assignedTo: 'operator-1',
    };
    const actor = { sub: 'operator-1', email: 'op@veloxdesk.local', role: UserRole.OPERATOR };

    await service.postMessage(ticket as never, actor, '<p>Чиним</p>', false);

    expect(telegramOutbound.relay).toHaveBeenCalledWith(
      '999',
      expect.any(String),
      expect.objectContaining({ inline_keyboard: [[expect.objectContaining({ text: 'Open ticket' })]] }),
    );
  });
});
