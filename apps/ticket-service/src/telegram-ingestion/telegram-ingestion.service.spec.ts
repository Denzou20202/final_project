import { BOT_STRINGS } from '@veloxdesk/common';
import { Locale, TicketStatus } from '@veloxdesk/types';

// Minimal TicketStatusEntity-shaped fixtures — the real entity has more
// fields, but only these are ever read by the code paths under test.
const OPEN_STATUS = { id: 'status-open', key: TicketStatus.OPEN, name: 'В работе', color: '#C2683F', isDefault: true, isClosed: false, tracksSla: true, sortOrder: 1 };
const CLOSED_STATUS = { id: 'status-closed', key: TicketStatus.CLOSED, name: 'Завершено', color: '#C7BDAF', isDefault: false, isClosed: true, tracksSla: false, sortOrder: 4 };

const sendTelegramMessageMock = jest.fn().mockResolvedValue(undefined);
const sendTelegramPhotoMock = jest.fn().mockResolvedValue(undefined);
const sendTelegramDocumentMock = jest.fn().mockResolvedValue(undefined);
const answerTelegramCallbackQueryMock = jest.fn().mockResolvedValue(undefined);

// Only the outbound Telegram HTTP calls are faked — everything else
// (BOT_STRINGS included) stays real, so assertions below compare against
// the actual dictionary content rather than a second, parallel copy of it
// that could drift.
jest.mock('@veloxdesk/common', () => {
  const actual = jest.requireActual('@veloxdesk/common');
  return {
    ...actual,
    sendTelegramMessage: (...args: unknown[]) => sendTelegramMessageMock(...args),
    sendTelegramPhoto: (...args: unknown[]) => sendTelegramPhotoMock(...args),
    sendTelegramDocument: (...args: unknown[]) => sendTelegramDocumentMock(...args),
    answerTelegramCallbackQuery: (...args: unknown[]) => answerTelegramCallbackQueryMock(...args),
  };
});

// Import after the mock so the service picks up the faked sends.
import { TelegramIngestionService } from './telegram-ingestion.service.js';

function makeUpdate(text: string, chatId: number | string = 111): Record<string, unknown> {
  return { message: { chat: { id: chatId, type: 'private' }, text } };
}

function makeTicketOpenCallback(ticketId: string, chatId: number | string = 111): Record<string, unknown> {
  return {
    callback_query: { id: 'cb-1', data: `ticket:${ticketId}:m`, message: { chat: { id: chatId }, message_id: 5 } },
  };
}

// sendMyTickets/sendWatchingTickets/sendTicketHistory build their queries via
// createQueryBuilder (a status join replaced the old plain find()/count()
// filter) — every chain method returns `this` so `.innerJoinAndSelect(...)
// .where(...).andWhere(...).orderBy(...).take(...).getMany()` resolves the
// same way a real TypeORM query builder would.
function makeQueryBuilderMock(getManyResult: unknown[] = [], getCountResult = 0) {
  const qb: Record<string, jest.Mock> = {};
  for (const method of ['innerJoinAndSelect', 'leftJoinAndSelect', 'innerJoin', 'where', 'andWhere', 'orderBy', 'take']) {
    qb[method] = jest.fn().mockReturnValue(qb);
  }
  qb['getMany'] = jest.fn().mockResolvedValue(getManyResult);
  qb['getCount'] = jest.fn().mockResolvedValue(getCountResult);
  qb['getOne'] = jest.fn().mockResolvedValue(null);
  return qb;
}

describe('TelegramIngestionService', () => {
  let userResolver: { findByChatId: jest.Mock; linkByToken: jest.Mock };
  let ticketsRepository: { find: jest.Mock; count: jest.Mock; findOne: jest.Mock; createQueryBuilder: jest.Mock };
  let commentsRepository: { find: jest.Mock; count: jest.Mock };
  let usersRepository: { update: jest.Mock };
  let attachmentsRepository: { find: jest.Mock };
  let watchersRepository: { count: jest.Mock };
  let s3Service: { download: jest.Mock; upload: jest.Mock };
  let ticketEventsPublisher: { publish: jest.Mock };
  let activityRepository: { create: jest.Mock; save: jest.Mock };
  let service: TelegramIngestionService;

  beforeEach(() => {
    sendTelegramMessageMock.mockClear();
    sendTelegramPhotoMock.mockClear();
    sendTelegramDocumentMock.mockClear();
    answerTelegramCallbackQueryMock.mockClear();

    userResolver = { findByChatId: jest.fn(), linkByToken: jest.fn() };
    ticketsRepository = {
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(() => makeQueryBuilderMock()),
    };
    commentsRepository = { find: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) };
    usersRepository = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
    attachmentsRepository = { find: jest.fn().mockResolvedValue([]) };
    watchersRepository = { count: jest.fn().mockResolvedValue(0) };
    s3Service = { download: jest.fn(), upload: jest.fn().mockResolvedValue(undefined) };
    const config = { get: jest.fn().mockReturnValue('fake-bot-token') };
    ticketEventsPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    activityRepository = {
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockResolvedValue(undefined),
    };
    (attachmentsRepository as unknown as { create: jest.Mock; save: jest.Mock }).create = jest
      .fn()
      .mockImplementation((v) => v);
    (attachmentsRepository as unknown as { create: jest.Mock; save: jest.Mock }).save = jest
      .fn()
      .mockResolvedValue(undefined);

    service = new TelegramIngestionService(
      config as never,
      userResolver as never,
      {} as never, // notificationsProducer
      ticketEventsPublisher as never,
      {} as never, // slaPoliciesRepository
      {} as never, // searchIndexProducer
      {} as never, // automationTriggerProducer
      s3Service as never,
      {} as never, // csatService
      ticketsRepository as never,
      commentsRepository as never,
      activityRepository as never,
      usersRepository as never,
      {} as never, // articlesRepository
      attachmentsRepository as never,
      {} as never, // csatQuestionsRepository
      watchersRepository as never,
      {} as never, // ticketStatusesRepository
      {} as never, // ticketTypesRepository
    );
  });

  describe('locale-aware replies', () => {
    it('greets a linked English-locale user in English', async () => {
      userResolver.findByChatId.mockResolvedValue({ id: 'user-1', locale: Locale.EN });

      await service.processUpdate(makeUpdate('/start'));

      expect(sendTelegramMessageMock).toHaveBeenCalledWith(
        'fake-bot-token',
        '111',
        BOT_STRINGS[Locale.EN].greetingLinked,
        expect.objectContaining({ keyboard: expect.arrayContaining([expect.arrayContaining([BOT_STRINGS[Locale.EN].btnCreateTicket])]) }),
        undefined,
      );
    });

    it('defaults an unlinked stranger to Russian (no user row to read a locale from)', async () => {
      userResolver.findByChatId.mockResolvedValue(null);

      await service.processUpdate(makeUpdate('/start'));

      expect(sendTelegramMessageMock).toHaveBeenCalledWith(
        'fake-bot-token',
        '111',
        BOT_STRINGS[Locale.RU].greetingUnlinked,
        { remove_keyboard: true },
        undefined,
      );
    });

    // The regression this guards: a client's physical Telegram keyboard keeps
    // showing whatever locale it was last rendered in. If they then switch
    // language on the web portal without reopening the bot's menu, their next
    // tap still carries the OLD locale's button label. Routing must still
    // recognize that tap as "Мои тикеты" even though the sender's current
    // locale is English — and the bot's own reply must come back in English
    // (the sender's current locale), not Russian (the tapped label's locale).
    it('routes a stale-locale keyboard tap correctly and replies in the current locale', async () => {
      userResolver.findByChatId.mockResolvedValue({ id: 'user-1', locale: Locale.EN, telegramPendingNewTicket: false });

      await service.processUpdate(makeUpdate(BOT_STRINGS[Locale.RU].btnMyTickets));

      expect(ticketsRepository.createQueryBuilder).toHaveBeenCalledWith('ticket');
      expect(sendTelegramMessageMock).toHaveBeenCalledWith(
        'fake-bot-token',
        '111',
        BOT_STRINGS[Locale.EN].myTicketsEmpty,
        expect.anything(),
        undefined,
      );
    });
  });

  describe('ticket detail — real chat with inline attachments', () => {
    it('opening a ticket sends an attachment-only comment as a real photo (not a filename list) and arms the pending-reply target', async () => {
      userResolver.findByChatId.mockResolvedValue({ id: 'user-1', locale: Locale.EN });
      ticketsRepository.findOne.mockResolvedValue({
        id: 'ticket-1',
        ticketNumber: 42,
        title: 'Printer broken',
        status: OPEN_STATUS,
        priority: 'medium',
        createdAt: new Date(),
        createdBy: 'user-1',
      });
      commentsRepository.find.mockResolvedValue([
        { id: 'comment-1', authorId: 'user-1', body: '', createdAt: new Date(), author: null },
      ]);
      commentsRepository.count.mockResolvedValue(1);
      attachmentsRepository.find.mockResolvedValue([
        { id: 'att-1', commentId: 'comment-1', fileUrl: 'ticket-1/key.png', fileName: 'photo.png' },
      ]);
      s3Service.download.mockResolvedValue({ body: Buffer.from('fake-bytes'), contentType: 'image/png' });

      await service.processUpdate(makeTicketOpenCallback('ticket-1'));

      expect(usersRepository.update).toHaveBeenCalledWith(
        { id: 'user-1' },
        { telegramPendingReplyToTicketId: 'ticket-1', telegramPendingNewTicket: false },
      );
      // Sole job in the sequence — both the caption (time/author, since the
      // comment itself had no text) and the trailing keyboard land on it.
      expect(sendTelegramPhotoMock).toHaveBeenCalledWith(
        'fake-bot-token',
        '111',
        expect.any(Buffer),
        'photo.png',
        'image/png',
        expect.stringContaining(BOT_STRINGS[Locale.EN].youLabel),
        expect.objectContaining({ inline_keyboard: expect.any(Array) }),
      );
      expect(sendTelegramDocumentMock).not.toHaveBeenCalled();
    });

    it('attaches the keyboard only to the last message in the sequence, not an earlier text comment', async () => {
      userResolver.findByChatId.mockResolvedValue({ id: 'user-1', locale: Locale.EN });
      ticketsRepository.findOne.mockResolvedValue({
        id: 'ticket-1',
        ticketNumber: 7,
        title: 'Test',
        status: OPEN_STATUS,
        priority: 'medium',
        createdAt: new Date(),
        createdBy: 'user-1',
      });
      commentsRepository.find.mockResolvedValue([
        { id: 'comment-1', authorId: 'user-1', body: '<p>Here is the file</p>', createdAt: new Date(), author: null },
      ]);
      commentsRepository.count.mockResolvedValue(1);
      attachmentsRepository.find.mockResolvedValue([
        { id: 'att-1', commentId: 'comment-1', fileUrl: 'ticket-1/key.pdf', fileName: 'report.pdf' },
      ]);
      s3Service.download.mockResolvedValue({ body: Buffer.from('fake-bytes'), contentType: 'application/pdf' });

      await service.processUpdate(makeTicketOpenCallback('ticket-1'));

      // Header message, then the comment's own text — neither carries a keyboard.
      const textCalls = sendTelegramMessageMock.mock.calls;
      for (const call of textCalls) {
        expect(call[3]).toBeUndefined();
      }
      // The trailing attachment (a non-image, so sendDocument) carries it.
      expect(sendTelegramDocumentMock).toHaveBeenCalledWith(
        'fake-bot-token',
        '111',
        expect.any(Buffer),
        'report.pdf',
        'application/pdf',
        undefined,
        expect.objectContaining({ inline_keyboard: expect.any(Array) }),
      );
    });

    it('does not arm the pending-reply target when opening a CLOSED ticket', async () => {
      userResolver.findByChatId.mockResolvedValue({ id: 'user-1', locale: Locale.EN });
      ticketsRepository.findOne.mockResolvedValue({
        id: 'ticket-1',
        ticketNumber: 3,
        title: 'Old issue',
        status: CLOSED_STATUS,
        priority: 'low',
        createdAt: new Date(),
        createdBy: 'user-1',
      });

      await service.processUpdate(makeTicketOpenCallback('ticket-1'));

      expect(usersRepository.update).not.toHaveBeenCalled();
    });
  });

  // Regression coverage: unlike a web upload, a Telegram "document" never
  // goes through AttachmentsController's ParseFilePipe/FileTypeValidator/
  // MaxFileSizeValidator at all — mime_type is whatever the sender's
  // Telegram client declared, with no size cap from this codebase. A
  // Telegram-linked client used to be able to attach anything at all this
  // way, bypassing every check a web upload would enforce.
  describe('uploadTelegramAttachment — validation parity with the web upload path', () => {
    function callUpload(file: { buffer: Buffer; filename: string; mimeType: string }) {
      return (
        service as unknown as {
          uploadTelegramAttachment: (
            ticket: { id: string; ticketNumber: number; title: string; teamId: string | null; assignedTo: string | null; createdBy: string; status: unknown },
            commentId: string,
            uploaderId: string,
            file: { buffer: Buffer; filename: string; mimeType: string },
          ) => Promise<void>;
        }
      ).uploadTelegramAttachment(
        {
          id: 'ticket-1',
          ticketNumber: 1,
          title: 'Test',
          teamId: null,
          assignedTo: null,
          createdBy: 'client-1',
          status: { key: 'open' },
        },
        'comment-1',
        'client-1',
        file,
      );
    }

    it('skips an attachment whose declared mime type is outside the allowlist', async () => {
      await callUpload({ buffer: Buffer.from('MZ...'), filename: 'invoice.exe', mimeType: 'application/x-msdownload' });
      expect(s3Service.upload).not.toHaveBeenCalled();
    });

    it('skips an attachment larger than the web upload size limit', async () => {
      await callUpload({
        buffer: Buffer.alloc(36 * 1024 * 1024),
        filename: 'big.png',
        mimeType: 'image/png',
      });
      expect(s3Service.upload).not.toHaveBeenCalled();
    });

    // Regression: same S3-key path-traversal gap as the web upload path
    // (attachments.service.ts) — `doc.file_name` is fully sender-controlled
    // and used to go straight into the key with zero sanitization.
    it('strips path separators and traversal sequences from the filename before building the S3 key', async () => {
      await callUpload({
        buffer: Buffer.from('fake-png-bytes'),
        filename: '../../../other-ticket/evil.png',
        mimeType: 'image/png',
      });
      const key = s3Service.upload.mock.calls[0][0] as string;
      expect(key.startsWith('ticket-1/')).toBe(true);
      expect(key).not.toContain('..');
      expect(key.split('/')).toHaveLength(2);
    });
  });
});
