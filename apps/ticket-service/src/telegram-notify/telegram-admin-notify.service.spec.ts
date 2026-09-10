const sendTelegramMessageMock = jest.fn().mockResolvedValue(undefined);

jest.mock('@veloxdesk/common', () => {
  const actual = jest.requireActual('@veloxdesk/common');
  return { ...actual, sendTelegramMessage: (...args: unknown[]) => sendTelegramMessageMock(...args) };
});

import { TelegramAdminNotifyService } from './telegram-admin-notify.service.js';

describe('TelegramAdminNotifyService.notifyRegistrationPending', () => {
  let usersRepository: { find: jest.Mock };
  let service: TelegramAdminNotifyService;

  beforeEach(() => {
    sendTelegramMessageMock.mockClear();
    usersRepository = { find: jest.fn() };
    const config = { get: jest.fn().mockReturnValue('fake-bot-token') };
    service = new TelegramAdminNotifyService(config as never, usersRepository as never);
  });

  it('notifies every admin with a linked Telegram chat', async () => {
    usersRepository.find.mockResolvedValue([{ id: 'admin-1', telegramChatId: '111' }]);

    await service.notifyRegistrationPending({ type: 'registration_pending', userId: 'u1', email: 'a@b.com', fullName: 'A B' });

    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
  });

  // Regression test: this method is fired with `void ...(...)` and no
  // .catch by TelegramUserEventsSubscriberService, and this app has no
  // process-level unhandledRejection handler — an uncaught throw here
  // (e.g. a transient DB blip on usersRepository.find) used to become an
  // unhandled promise rejection that kills the entire ticket-service
  // process, not just this one notification.
  it('never throws, even when the DB lookup itself fails', async () => {
    usersRepository.find.mockRejectedValue(new Error('DB blip'));

    await expect(
      service.notifyRegistrationPending({ type: 'registration_pending', userId: 'u1', email: 'a@b.com', fullName: 'A B' }),
    ).resolves.toBeUndefined();
  });
});
