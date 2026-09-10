import { UserRole } from '@veloxdesk/types';
import { WsException } from '@nestjs/websockets';
import { ChatService } from './chat.service.js';

function makeActor(overrides: Record<string, unknown> = {}) {
  return { sub: 'operator-1', email: 'op@veloxdesk.local', role: UserRole.OPERATOR, ...overrides };
}

// Ticket belongs to team-1 — an operator restricted to team-2 fails
// staffCanSeeTicket and falls through to the mention check.
const outOfScopeTicket = {
  id: 'ticket-1',
  createdBy: 'client-1',
  assignedTo: null,
  teamId: 'team-1',
  status: { isClosed: false },
  deletedAt: null,
};

describe('ChatService.getTicketForParticipant — @mention access exception', () => {
  let ticketsRepository: { findOne: jest.Mock };
  let mentionsRepository: { count: jest.Mock };
  let service: ChatService;

  beforeEach(() => {
    ticketsRepository = { findOne: jest.fn().mockResolvedValue(outOfScopeTicket) };
    mentionsRepository = { count: jest.fn().mockResolvedValue(0) };

    service = new ChatService(
      ticketsRepository as never,
      {} as never, // commentsRepository
      {} as never, // watchersRepository
      mentionsRepository as never,
      {} as never, // activityRepository
      {} as never, // usersRepository
      {} as never, // notificationsProducer
      {} as never, // automationTriggerProducer
      {} as never, // telegramOutbound
    );
  });

  it('rejects a department-restricted operator who was never mentioned', async () => {
    await expect(
      service.getTicketForParticipant('ticket-1', makeActor({ restrictToDepartments: true, departmentIds: ['team-2'] })),
    ).rejects.toThrow(WsException);
    expect(mentionsRepository.count).toHaveBeenCalledWith({ where: { ticketId: 'ticket-1', userId: 'operator-1' } });
  });

  it('allows a department-restricted operator who was @mentioned on this ticket', async () => {
    mentionsRepository.count.mockResolvedValue(1);
    await expect(
      service.getTicketForParticipant('ticket-1', makeActor({ restrictToDepartments: true, departmentIds: ['team-2'] })),
    ).resolves.toMatchObject({ id: 'ticket-1' });
  });

  it('never checks mentions for an operator already in scope', async () => {
    await expect(
      service.getTicketForParticipant('ticket-1', makeActor({ restrictToDepartments: true, departmentIds: ['team-1'] })),
    ).resolves.toMatchObject({ id: 'ticket-1' });
    expect(mentionsRepository.count).not.toHaveBeenCalled();
  });
});

describe('ChatService.postMessage — persisting @mentions', () => {
  let mentionsRepository: { createQueryBuilder: jest.Mock };
  let insertBuilder: {
    insert: jest.Mock;
    into: jest.Mock;
    values: jest.Mock;
    orIgnore: jest.Mock;
    execute: jest.Mock;
  };
  let service: ChatService;
  const ticket = {
    id: 'ticket-1',
    ticketNumber: 1,
    title: 'Тест',
    status: { isClosed: false },
    deletedAt: null,
    createdBy: 'client-1',
    assignedTo: null,
  };

  beforeEach(() => {
    insertBuilder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    };
    mentionsRepository = { createQueryBuilder: jest.fn().mockReturnValue(insertBuilder) };

    service = new ChatService(
      {} as never, // ticketsRepository
      { create: jest.fn((d) => d), save: jest.fn().mockResolvedValue({ id: 'comment-1' }) } as never, // commentsRepository
      { find: jest.fn().mockResolvedValue([]) } as never, // watchersRepository
      mentionsRepository as never,
      {} as never, // activityRepository
      { findOne: jest.fn().mockResolvedValue(null) } as never, // usersRepository
      { enqueue: jest.fn() } as never, // notificationsProducer
      { enqueue: jest.fn() } as never, // automationTriggerProducer
      { relay: jest.fn() } as never, // telegramOutbound
    );
  });

  it('inserts a ticket_mentions row for each @mentioned user, idempotently', async () => {
    const body = `<p>Привет <span data-type="mention" data-id="11111111-1111-1111-1111-111111111111">Оператор</span></p>`;
    const actor = { sub: 'operator-1', email: 'op@veloxdesk.local', role: UserRole.OPERATOR };

    await service.postMessage(ticket as never, actor, body, false);

    expect(mentionsRepository.createQueryBuilder).toHaveBeenCalled();
    expect(insertBuilder.values).toHaveBeenCalledWith([
      { ticketId: 'ticket-1', userId: '11111111-1111-1111-1111-111111111111' },
    ]);
    expect(insertBuilder.orIgnore).toHaveBeenCalled();
  });

  it('skips the insert entirely when the message has no mentions', async () => {
    const actor = { sub: 'operator-1', email: 'op@veloxdesk.local', role: UserRole.OPERATOR };
    await service.postMessage(ticket as never, actor, '<p>Без упоминаний</p>', false);
    expect(mentionsRepository.createQueryBuilder).not.toHaveBeenCalled();
  });
});

describe('ChatService.postMessage — mention notifications never leak an internal note to the client', () => {
  // Deliberately names the ticket's own creator as the mentioned user —
  // regression coverage for the bug where the mention-notification loop had
  // no internal-note guard (unlike recipientId/watchers right next to it),
  // so an internal note mentioning the client would still email/push them.
  const ticket = {
    id: 'ticket-1',
    ticketNumber: 1,
    title: 'Тест',
    status: { isClosed: false },
    deletedAt: null,
    createdBy: 'client-1',
    assignedTo: null,
  };
  const body = `<p><span data-type="mention" data-id="client-1">Клиент</span></p>`;
  const actor = { sub: 'operator-1', email: 'op@veloxdesk.local', role: UserRole.OPERATOR };

  function makeService(notificationsProducer: { enqueue: jest.Mock }) {
    return new ChatService(
      {} as never,
      { create: jest.fn((d) => d), save: jest.fn().mockResolvedValue({ id: 'comment-1' }) } as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      { createQueryBuilder: jest.fn().mockReturnValue({ insert: jest.fn().mockReturnThis(), into: jest.fn().mockReturnThis(), values: jest.fn().mockReturnThis(), orIgnore: jest.fn().mockReturnThis(), execute: jest.fn().mockResolvedValue({}) }) } as never,
      {} as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      notificationsProducer as never,
      { enqueue: jest.fn() } as never,
      { relay: jest.fn() } as never,
    );
  }

  it('never enqueues a MENTION notification to the client from an internal note', async () => {
    const notificationsProducer = { enqueue: jest.fn() };
    await makeService(notificationsProducer).postMessage(ticket as never, actor, body, true);

    expect(notificationsProducer.enqueue).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mention', userId: 'client-1' }),
    );
  });

  // A public note is fine to notify the client about either way — they can
  // see it regardless. The REPLY recipient computation happens to already
  // target the client here too (actor is staff, so recipientId is always
  // ticket.createdBy on a public note), so this collapses to a REPLY
  // notification rather than a MENTION one (existing, unrelated dedup
  // behavior) — the point of this test is only that SOME notification
  // reaches them, unlike the internal-note case above where none does.
  it('does notify the client from a public reply that mentions them', async () => {
    const notificationsProducer = { enqueue: jest.fn() };
    await makeService(notificationsProducer).postMessage(ticket as never, actor, body, false);

    expect(notificationsProducer.enqueue).toHaveBeenCalledWith(expect.objectContaining({ userId: 'client-1' }));
  });
});
