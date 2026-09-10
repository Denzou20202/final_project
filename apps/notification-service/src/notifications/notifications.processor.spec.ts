import { Locale, NotificationType, TicketStatus } from '@veloxdesk/types';
import { NotificationsProcessor } from './notifications.processor.js';

// attemptsMade defaults to 0, matching a real BullMQ Job on its first
// processing attempt — the processor's record-before-send guard branches on
// this field, so a mock job must model it accurately (override it to
// simulate a retry).
function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    data: { type: NotificationType.REPLY, userId: 'user-1', ticketId: 'ticket-1' },
    attemptsMade: 0,
    ...overrides,
  };
}

describe('NotificationsProcessor.process — record-before-send ordering', () => {
  let mailer: { send: jest.Mock };
  let usersRepository: { findOne: jest.Mock };
  let ticketsRepository: { findOne: jest.Mock };
  let notificationsRepository: { create: jest.Mock; save: jest.Mock };
  let processor: NotificationsProcessor;
  const callOrder: string[] = [];

  beforeEach(() => {
    callOrder.length = 0;
    mailer = { send: jest.fn().mockImplementation(async () => { callOrder.push('send'); }) };
    usersRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'user-1', email: 'a@b.com', fullName: 'Иван', locale: Locale.RU }),
    };
    ticketsRepository = { findOne: jest.fn().mockResolvedValue({ id: 'ticket-1', title: 'Тест', status: TicketStatus.OPEN }) };
    notificationsRepository = {
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation(async () => { callOrder.push('save'); }),
    };
    processor = new NotificationsProcessor(
      mailer as never,
      usersRepository as never,
      ticketsRepository as never,
      notificationsRepository as never,
    );
  });

  it('persists the notification record before sending the email', async () => {
    await processor.process(makeJob() as never);

    expect(callOrder).toEqual(['save', 'send']);
  });

  it('never sends an email if persisting the record fails — a retry starts clean instead of resending', async () => {
    notificationsRepository.save.mockRejectedValue(new Error('DB blip'));

    await expect(processor.process(makeJob() as never)).rejects.toThrow('DB blip');
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('skips the record write on a retry (attemptsMade > 0) but still resends the email', async () => {
    await processor.process(makeJob({ attemptsMade: 1 }) as never);

    expect(notificationsRepository.create).not.toHaveBeenCalled();
    expect(notificationsRepository.save).not.toHaveBeenCalled();
    expect(mailer.send).toHaveBeenCalledTimes(1);
  });

  // Regression test: email used to always render in Russian regardless of
  // the recipient's own UserEntity.locale, unlike every other real-time
  // surface (web UI, Telegram bot) which already respected it.
  it('renders the email in the recipient’s own locale, not always Russian', async () => {
    usersRepository.findOne.mockResolvedValue({ id: 'user-1', email: 'a@b.com', fullName: 'Ivan', locale: Locale.EN });

    await processor.process(makeJob() as never);

    const [, subject] = mailer.send.mock.calls[0];
    expect(subject).toMatch(/^New reply on ticket/);
  });
});
