import { JwtPayload, sendTelegramDocument, sendTelegramPhoto } from '@veloxdesk/common';
import { AttachmentEntity, CommentEntity, UserEntity } from '@veloxdesk/database';
import { TicketActivityType, UserRole } from '@veloxdesk/types';
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { TicketActivityRepository } from '../tickets/ticket-activity.repository.js';
import { TicketsService } from '../tickets/tickets.service.js';
import { PublicAttachment, toPublicAttachment } from './attachment.public.js';
import { safeStoredContentType, sanitizeAttachmentFileName } from './attachment-mime-types.js';
import { S3Service } from './s3.service.js';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly ticketsService: TicketsService,
    private readonly activityRepository: TicketActivityRepository,
    private readonly s3Service: S3Service,
    private readonly config: ConfigService,
    @InjectRepository(AttachmentEntity)
    private readonly attachmentsRepository: Repository<AttachmentEntity>,
    @InjectRepository(CommentEntity)
    private readonly commentsRepository: Repository<CommentEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  // commentId is set by the composer's stage-then-send flow: the message is
  // sent first (so its id exists), then each staged file is uploaded with
  // that id attached, all before the file ever touches the server — nothing
  // is uploaded while still "staged" client-side, so there's no orphaned-
  // upload cleanup to worry about if the user removes a staged file instead
  // of sending it. Left null for ticket-creation-time uploads (ticket-scoped
  // only, no synthetic first-message linking) and any caller that omits it.
  async upload(ticketId: string, file: UploadedFile, actor: JwtPayload, commentId?: string): Promise<PublicAttachment> {
    const ticket = await this.ticketsService.assertAccess(ticketId, actor);

    // A closed ticket is frozen — same rule chat-service's postMessage/
    // editMessage enforce for message text. An attachment is just as much
    // new ticket content, whether it's being attached to an existing
    // comment or uploaded standalone, so this check applies either way.
    if (ticket.status.isClosed) {
      throw new BadRequestException('Тикет завершён — новые сообщения недоступны');
    }

    let internalComment = false;
    if (commentId) {
      const comment = await this.commentsRepository.findOne({ where: { id: commentId, ticketId } });
      if (!comment) {
        throw new NotFoundException('Comment not found');
      }
      // Author-only, same rule as editing a message — attaching a file to
      // someone else's message isn't "my reply" anymore.
      if (comment.authorId !== actor.sub) {
        throw new ForbiddenException('Only the author can attach files to their own message');
      }
      internalComment = comment.isInternal;
    }

    const key = `${ticketId}/${randomUUID()}-${sanitizeAttachmentFileName(file.originalname)}`;
    // Never persist file.mimetype verbatim: NestJS's FileTypeValidator only
    // checks the SNIFFED magic-number type against the allowlist when
    // sniffing succeeds — it never cross-checks the client-declared
    // mimetype against anything in that case. A file with genuine PNG bytes
    // and a declared type of "text/html" passes validation as-is; storing
    // that declared value as the S3 object's ContentType would mean the
    // download endpoint later serves attacker-chosen HTML. See
    // attachment-mime-types.ts for the independent re-check.
    await this.s3Service.upload(key, file.buffer, safeStoredContentType(file.mimetype));

    const attachment = await this.attachmentsRepository.save(
      this.attachmentsRepository.create({
        ticketId,
        uploaderId: actor.sub,
        commentId: commentId ?? null,
        fileUrl: key,
        fileName: file.originalname,
        fileSize: file.size,
      }),
    );

    await this.activityRepository.log({
      ticketId,
      actorId: actor.sub,
      type: TicketActivityType.ATTACHMENT_ADDED,
      toValue: file.originalname,
      // Mirrors ChatService.editMessage's MESSAGE_EDITED entries — a file
      // attached to an internal-only staff note must be exactly as invisible
      // via GET /tickets/:id/activity (ungated by role, filtered by
      // TicketsService.getActivity for CLIENT) as the file itself already is
      // via AttachmentsService.list()/getFile(). Missing this let a CLIENT
      // see the internal attachment's original filename in the activity
      // feed even though downloading it correctly 404s.
      internal: internalComment,
    });

    // Live push so the OTHER party (whoever didn't just upload this file)
    // sees it without a manual page refresh — see notifyAttachmentAdded's
    // own comment for why this needs its own event rather than piggybacking
    // on the message-send notify.
    await this.ticketsService.notifyAttachmentAdded(ticketId, actor.sub);

    // Relay to Telegram — mirrors chat.service.ts's text-reply relay: fires
    // for ANY ticket the client owns with a linked Telegram account, not
    // just ones that originated on Telegram (that channel-scoped gate was
    // dropped from the text-reply relay on 2026-08-13; this attachment
    // relay was missed at the time, see CHECKLIST.md). Still gated on a
    // genuine staff upload (actor.role !== CLIENT) so a client's own
    // upload never echoes back to them — relayAttachmentToTelegram itself
    // no-ops when the client has no telegramChatId linked. Also gated on
    // !internalComment: a file attached to an internal staff note must
    // never leave the ticket, same rule getHistory already applies to the
    // note's text — the role check alone only proved the uploader was
    // staff, not that the file was meant for the client. Fire-and-forget
    // for the same reason as the text relay — the file is already durably
    // stored in S3 above, so a slow/failed Telegram push never loses data,
    // only delays the client seeing it.
    if (actor.role !== UserRole.CLIENT && !internalComment) {
      void this.relayAttachmentToTelegram(ticket.createdBy, file);
    }

    return toPublicAttachment(attachment);
  }

  private async relayAttachmentToTelegram(clientId: string, file: UploadedFile): Promise<void> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) return;
    const client = await this.usersRepository.findOne({ where: { id: clientId } });
    if (!client?.telegramChatId) return;

    // sendPhoto renders inline with a preview; anything else (PDFs, docs,
    // archives) goes through sendDocument. Uses the browser-reported
    // mimetype from the original upload — no need to re-download/re-sniff
    // the file we already have the bytes for.
    const send = file.mimetype.startsWith('image/')
      ? sendTelegramPhoto(token, client.telegramChatId, file.buffer, file.originalname, file.mimetype)
      : sendTelegramDocument(token, client.telegramChatId, file.buffer, file.originalname, file.mimetype);

    await send.catch((error) => {
      this.logger.warn(`Failed to relay attachment to Telegram: ${error instanceof Error ? error.message : error}`);
    });
  }

  // A client only ever sees the public reply thread (chat.service.ts's
  // getHistory) — a file attached to an internal staff note must be exactly
  // as invisible to them here as that note's text already is. commentId is
  // nullable (a bare ticket-level upload, not linked to any note) and
  // always visible; only a join to an isInternal comment is excluded.
  async list(ticketId: string, actor: JwtPayload): Promise<PublicAttachment[]> {
    await this.ticketsService.assertAccess(ticketId, actor, true);
    const query = this.attachmentsRepository
      .createQueryBuilder('attachment')
      .leftJoin('attachment.comment', 'comment')
      .where('attachment.ticketId = :ticketId', { ticketId })
      .orderBy('attachment.createdAt', 'ASC');
    if (actor.role === UserRole.CLIENT) {
      query.andWhere('(comment.isInternal IS NULL OR comment.isInternal = false)');
    }
    const rows = await query.getMany();
    return rows.map(toPublicAttachment);
  }

  // Returns the actual bytes rather than a presigned URL — the browser can
  // never reach MinIO directly (S3_ENDPOINT is the Docker-internal
  // "minio:9000"), so the file has to be fetched server-side and streamed
  // back through this already-public route. Whether that ends up as a
  // forced download or an inline image is a frontend decision (via how it
  // uses the resulting blob) — this layer just hands over the content.
  async getFile(id: string, actor: JwtPayload): Promise<{ body: Buffer; contentType: string; fileName: string }> {
    const attachment = await this.attachmentsRepository.findOne({ where: { id }, relations: { comment: true } });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    await this.ticketsService.assertAccess(attachment.ticketId, actor, true);
    // Same rule as list() above, enforced again here since a client could
    // otherwise hit this route directly with an id scraped some other way
    // (or from before this attachment's note was marked internal). 404,
    // not 403 — same "don't confirm it exists" convention getTicketOrThrow
    // uses for out-of-scope tickets.
    if (actor.role === UserRole.CLIENT && attachment.comment?.isInternal) {
      throw new NotFoundException('Attachment not found');
    }
    const { body, contentType } = await this.s3Service.download(attachment.fileUrl);
    return { body, contentType, fileName: attachment.fileName };
  }
}
