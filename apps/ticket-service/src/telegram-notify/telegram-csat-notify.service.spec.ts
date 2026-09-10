import { BOT_STRINGS } from '@veloxdesk/common';
import { Locale, TicketChannel } from '@veloxdesk/types';

const sendTelegramMessageMock = jest.fn().mockResolvedValue(undefined);

jest.mock('@veloxdesk/common', () => {
  const actual = jest.requireActual('@veloxdesk/common');
  return { ...actual, sendTelegramMessage: (...args: unknown[]) => sendTelegramMessageMock(...args) };
});

import { TelegramCsatNotifyService } from './telegram-csat-notify.service.js';

describe('TelegramCsatNotifyService.notifyTicketClosed', () => {
  let usersRepository: { findOne: jest.Mock };
  let questionsRepository: { find: jest.Mock };
  let service: TelegramCsatNotifyService;

  beforeEach(() => {
    sendTelegramMessageMock.mockClear();
    usersRepository = { findOne: jest.fn() };
    questionsRepository = { find: jest.fn().mockResolvedValue([]) };
    const config = { get: jest.fn().mockReturnValue('fake-bot-token') };

    service = new TelegramCsatNotifyService(config as never, usersRepository as never, questionsRepository as never);
  });

  it("closes a Telegram-channel ticket with no CSAT questions in the client's own locale", async () => {
    usersRepository.findOne.mockResolvedValue({ id: 'client-1', locale: Locale.UK, telegramChatId: '555' });

    await service.notifyTicketClosed({ id: 't-1', ticketNumber: 12, channel: TicketChannel.TELEGRAM, createdBy: 'client-1' });

    expect(sendTelegramMessageMock).toHaveBeenCalledWith(
      'fake-bot-token',
      '555',
      BOT_STRINGS[Locale.UK].csatClosedNoQuestions(12),
    );
  });

  // Regression test: a DB failure (usersRepository.findOne/questionsRepository.
  // find) used to be uncaught, so it propagated straight to the caller —
  // TicketsService.applyAutomatedStatus awaited this BEFORE its own
  // broadcastTicketUpdated call, meaning that real-time push silently never
  // ran at all on a transient DB blip.
  it('never throws, even when the DB lookup itself fails', async () => {
    usersRepository.findOne.mockRejectedValue(new Error('DB blip'));

    await expect(
      service.notifyTicketClosed({ id: 't-1', ticketNumber: 12, channel: TicketChannel.TELEGRAM, createdBy: 'client-1' }),
    ).resolves.toBeUndefined();
  });
});
