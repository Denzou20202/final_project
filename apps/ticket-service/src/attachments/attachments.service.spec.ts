import { JwtPayload } from '@veloxdesk/common';
import { UserRole } from '@veloxdesk/types';
import { NotFoundException } from '@nestjs/common';
import { AttachmentsService } from './attachments.service.js';

const sendTelegramPhoto = jest.fn().mockResolvedValue(undefined);
const sendTelegramDocument = jest.fn().mockResolvedValue(undefined);
jest.mock('@veloxdesk/common', () => ({
  sendTelegramPhoto: (...args: unknown[]) => sendTelegramPhoto(...args),
  sendTelegramDocument: (...args: unknown[]) => sendTelegramDocument(...args),
}));

function makeActor(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return { sub: 'user-1', email: 'user@veloxdesk.local', role: UserRole.CLIENT, ...overrides };
}

// Regression coverage for a real data leak: attachments.service.ts's
// list()/getFile() used to check only ticket-level access (assertAccess),
// never whether the attachment's own comment was an internal staff note —
// a client could list and download a file a staff member attached to an
// internal note, even though that same note's TEXT was already correctly
// hidden from them (chat.service.ts's getHistory filters isInternal).
describe('AttachmentsService', () => {
  let ticketsService: { assertAccess: jest.Mock };
  let attachmentsRepository: { createQueryBuilder: jest.Mock; findOne: jest.Mock };
  let queryBuilder: {
    leftJoin: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    getMany: jest.Mock;
  };
  let service: AttachmentsService;

  beforeEach(() => {
    queryBuilder = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    ticketsService = { assertAccess: jest.fn().mockResolvedValue({ id: 'ticket-1', status: { isClosed: false } }) };
    attachmentsRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      findOne: jest.fn(),
    };

    service = new AttachmentsService(
      ticketsService as never,
      {} as never,
      {} as never,
      {} as never,
      attachmentsRepository as never,
      {} as never,
      {} as never,
    );
  });

  describe('upload — Telegram relay', () => {
    let commentsRepository: { findOne: jest.Mock };
    let usersRepository: { findOne: jest.Mock };
    let config: { get: jest.Mock };
    let activityRepository: { log: jest.Mock };

    beforeEach(() => {
      sendTelegramPhoto.mockClear();
      sendTelegramDocument.mockClear();
      ticketsService = {
        assertAccess: jest.fn().mockResolvedValue({
          id: 'ticket-1',
          createdBy: 'client-1',
          status: { isClosed: false },
        }),
      } as never;
      commentsRepository = { findOne: jest.fn() };
      usersRepository = { findOne: jest.fn().mockResolvedValue({ telegramChatId: 'chat-1' }) };
      config = { get: jest.fn().mockReturnValue('bot-token') };
      activityRepository = { log: jest.fn() };
      attachmentsRepository.createQueryBuilder = jest.fn();
      (attachmentsRepository as unknown as { save: jest.Mock; create: jest.Mock }).save = jest
        .fn()
        .mockImplementation((v) => v);
      (attachmentsRepository as unknown as { create: jest.Mock }).create = jest.fn().mockImplementation((v) => v);

      service = new AttachmentsService(
        { ...ticketsService, notifyAttachmentAdded: jest.fn() } as never,
        activityRepository as never,
        { upload: jest.fn().mockResolvedValue(undefined) } as never,
        config as never,
        attachmentsRepository as never,
        commentsRepository as never,
        usersRepository as never,
      );
    });

    const file = { originalname: 'a.png', mimetype: 'image/png', size: 10, buffer: Buffer.from('x') };

    // Regression: the Telegram relay used to fire for ANY staff upload,
    // gated only on actor.role !== CLIENT — never on whether the file was
    // attached to an internal staff note. A file dropped into an internal
    // comment (chat.service.ts hides that note's own TEXT from the client
    // already) would still be pushed straight to the client's Telegram DM.
    it('does not relay to Telegram a file attached to an internal comment', async () => {
      commentsRepository.findOne.mockResolvedValue({ authorId: 'staff-1', isInternal: true });

      await service.upload('ticket-1', file, makeActor({ sub: 'staff-1', role: UserRole.OPERATOR }), 'comment-1');
      await Promise.resolve();
      await Promise.resolve();

      expect(sendTelegramPhoto).not.toHaveBeenCalled();
      expect(sendTelegramDocument).not.toHaveBeenCalled();
    });

    it('relays to Telegram a file attached to a public comment', async () => {
      commentsRepository.findOne.mockResolvedValue({ authorId: 'staff-1', isInternal: false });

      await service.upload('ticket-1', file, makeActor({ sub: 'staff-1', role: UserRole.OPERATOR }), 'comment-1');
      await Promise.resolve();
      await Promise.resolve();

      expect(sendTelegramPhoto).toHaveBeenCalled();
    });

    // Regression: the ATTACHMENT_ADDED activity-log entry didn't carry the
    // same isInternal flag as the comment it was attached to, unlike
    // ChatService.editMessage's MESSAGE_EDITED entries — a CLIENT could see
    // an internal attachment's filename via GET /tickets/:id/activity even
    // though the file itself already correctly 404s.
    it('logs the attachment activity as internal when attached to an internal comment', async () => {
      commentsRepository.findOne.mockResolvedValue({ authorId: 'staff-1', isInternal: true });

      await service.upload('ticket-1', file, makeActor({ sub: 'staff-1', role: UserRole.OPERATOR }), 'comment-1');

      expect(activityRepository.log).toHaveBeenCalledWith(expect.objectContaining({ internal: true }));
    });

    it('logs the attachment activity as non-internal when attached to a public comment', async () => {
      commentsRepository.findOne.mockResolvedValue({ authorId: 'staff-1', isInternal: false });

      await service.upload('ticket-1', file, makeActor({ sub: 'staff-1', role: UserRole.OPERATOR }), 'comment-1');

      expect(activityRepository.log).toHaveBeenCalledWith(expect.objectContaining({ internal: false }));
    });
  });

  // Regression coverage for the stored-XSS gap: NestJS's FileTypeValidator
  // only checks the SNIFFED magic-number type against the allowlist when
  // sniffing succeeds — it never cross-checks the client-declared mimetype
  // in that case, so a file with genuine image bytes but a declared type of
  // "text/html" used to pass validation and then get persisted (and later
  // served) with that same lying declared type verbatim.
  describe('upload — stored Content-Type safety', () => {
    let s3Service: { upload: jest.Mock };

    beforeEach(() => {
      ticketsService = {
        assertAccess: jest.fn().mockResolvedValue({ id: 'ticket-1', createdBy: 'client-1', status: { isClosed: false } }),
        notifyAttachmentAdded: jest.fn(),
      } as never;
      s3Service = { upload: jest.fn().mockResolvedValue(undefined) };
      attachmentsRepository.createQueryBuilder = jest.fn();
      (attachmentsRepository as unknown as { save: jest.Mock; create: jest.Mock }).save = jest
        .fn()
        .mockImplementation((v) => v);
      (attachmentsRepository as unknown as { create: jest.Mock }).create = jest.fn().mockImplementation((v) => v);

      service = new AttachmentsService(
        ticketsService as never,
        { log: jest.fn() } as never,
        s3Service as never,
        { get: jest.fn() } as never,
        attachmentsRepository as never,
        { findOne: jest.fn() } as never,
        { findOne: jest.fn() } as never,
      );
    });

    it('never persists a declared mimetype outside the attachment allowlist', async () => {
      const file = { originalname: 'evil.png', mimetype: 'text/html', size: 10, buffer: Buffer.from('x') };
      await service.upload('ticket-1', file, makeActor({ role: UserRole.CLIENT }));
      expect(s3Service.upload).toHaveBeenCalledWith(expect.any(String), file.buffer, 'application/octet-stream');
    });

    it('persists a genuinely allowed declared mimetype unchanged', async () => {
      const file = { originalname: 'real.png', mimetype: 'image/png', size: 10, buffer: Buffer.from('x') };
      await service.upload('ticket-1', file, makeActor({ role: UserRole.CLIENT }));
      expect(s3Service.upload).toHaveBeenCalledWith(expect.any(String), file.buffer, 'image/png');
    });

    // Regression: the S3 key was built as `${ticketId}/${uuid}-${originalname}`
    // with zero sanitization of the client-supplied filename — a name
    // containing "/" or ".." could land the object outside the intended
    // ticket-scoped prefix on MinIO's filesystem-backed storage.
    it('strips path separators and traversal sequences from the filename before building the S3 key', async () => {
      const file = {
        originalname: '../../../other-ticket/evil.png',
        mimetype: 'image/png',
        size: 10,
        buffer: Buffer.from('x'),
      };
      await service.upload('ticket-1', file, makeActor({ role: UserRole.CLIENT }));
      const key = s3Service.upload.mock.calls[0][0] as string;
      expect(key.startsWith('ticket-1/')).toBe(true);
      expect(key).not.toContain('..');
      expect(key.split('/')).toHaveLength(2);
    });
  });

  describe('list', () => {
    it('adds an isInternal exclusion filter for a client actor', async () => {
      await service.list('ticket-1', makeActor({ role: UserRole.CLIENT }));

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('(comment.isInternal IS NULL OR comment.isInternal = false)');
    });

    it('does not restrict by isInternal for a staff actor', async () => {
      await service.list('ticket-1', makeActor({ role: UserRole.OPERATOR }));

      expect(queryBuilder.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('getFile', () => {
    it('404s a client trying to download an attachment linked to an internal comment', async () => {
      attachmentsRepository.findOne.mockResolvedValue({
        id: 'att-1',
        ticketId: 'ticket-1',
        fileUrl: 'ticket-1/secret.png',
        comment: { isInternal: true },
      });

      await expect(service.getFile('att-1', makeActor({ role: UserRole.CLIENT }))).rejects.toThrow(NotFoundException);
    });

    it('serves a client an attachment linked to a public comment', async () => {
      attachmentsRepository.findOne.mockResolvedValue({
        id: 'att-1',
        ticketId: 'ticket-1',
        fileUrl: 'ticket-1/photo.png',
        fileName: 'photo.png',
        comment: { isInternal: false },
      });
      const s3Service = { download: jest.fn().mockResolvedValue({ body: Buffer.from('x'), contentType: 'image/png' }) };
      service = new AttachmentsService(
        ticketsService as never,
        {} as never,
        s3Service as never,
        {} as never,
        attachmentsRepository as never,
        {} as never,
        {} as never,
      );

      const result = await service.getFile('att-1', makeActor({ role: UserRole.CLIENT }));

      expect(result.fileName).toBe('photo.png');
    });

    it('serves a staff actor an attachment linked to an internal comment', async () => {
      attachmentsRepository.findOne.mockResolvedValue({
        id: 'att-1',
        ticketId: 'ticket-1',
        fileUrl: 'ticket-1/internal.png',
        fileName: 'internal.png',
        comment: { isInternal: true },
      });
      const s3Service = { download: jest.fn().mockResolvedValue({ body: Buffer.from('x'), contentType: 'image/png' }) };
      service = new AttachmentsService(
        ticketsService as never,
        {} as never,
        s3Service as never,
        {} as never,
        attachmentsRepository as never,
        {} as never,
        {} as never,
      );

      const result = await service.getFile('att-1', makeActor({ role: UserRole.OPERATOR }));

      expect(result.fileName).toBe('internal.png');
    });
  });
});
