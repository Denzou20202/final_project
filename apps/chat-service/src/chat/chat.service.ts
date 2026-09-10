import {
  AutomationTriggerProducerService,
  BOT_STRINGS,
  commentHtmlToTelegramHtml,
  escapeTelegramHtml,
  extractMentionedUserIds,
  JwtPayload,
  NotificationsProducerService,
  sanitizeCommentBody,
  staffCanSeeTicket,
} from '@veloxdesk/common';
import type { TelegramInlineKeyboardMarkup } from '@veloxdesk/common';
import {
  CommentEntity,
  TicketActivityEntity,
  TicketEntity,
  TicketMentionEntity,
  TicketWatcherEntity,
  UserEntity,
} from '@veloxdesk/database';
import { AutomationTrigger, Locale, NotificationType, TicketActivityType, UserRole } from '@veloxdesk/types';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { WsException } from '@nestjs/websockets';
import { Repository } from 'typeorm';
import { PublicComment, toPublicComment } from './comment.public.js';
import { TelegramOutboundService } from './telegram-outbound.service.js';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(TicketEntity)
    private readonly ticketsRepository: Repository<TicketEntity>,
    @InjectRepository(CommentEntity)
    private readonly commentsRepository: Repository<CommentEntity>,
    @InjectRepository(TicketWatcherEntity)
    private readonly watchersRepository: Repository<TicketWatcherEntity>,
    @InjectRepository(TicketMentionEntity)
    private readonly mentionsRepository: Repository<TicketMentionEntity>,
    @InjectRepository(TicketActivityEntity)
    private readonly activityRepository: Repository<TicketActivityEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    private readonly notificationsProducer: NotificationsProducerService,
    private readonly automationTriggerProducer: AutomationTriggerProducerService,
    private readonly telegramOutbound: TelegramOutboundService,
  ) {}

  // Mirrors ticket-service's access rule exactly: a client may only join/
  // read/send in a ticket they created; staff additionally within their
  // permission-group scope (staffCanSeeTicket, from the JWT snapshot) —
  // otherwise the chat socket would be a side door into the full history of
  // tickets the REST API hides from a restricted operator.
  //
  // Uses WsException (not the HTTP-oriented ForbiddenException/NotFoundException)
  // because this service is only ever called from the Socket.IO gateway —
  // Nest's default WS exception filter flattens any non-WsException into an
  // opaque "Internal server error" for the client, losing the actual reason.
  // withDeleted so a trashed ticket still resolves — joining/reading its
  // history must keep working while it sits in Trash (see the deletedAt
  // guards in postMessage/editMessage below for what actually stays
  // blocked: new/edited messages, until the ticket is restored).
  async getTicketForParticipant(ticketId: string, actor: JwtPayload): Promise<TicketEntity> {
    const ticket = await this.ticketsRepository.findOne({
      where: { id: ticketId },
      relations: ['status'],
      withDeleted: true,
    });
    if (!ticket) {
      throw new WsException('Ticket not found');
    }
    if (actor.role === UserRole.CLIENT) {
      if (ticket.createdBy !== actor.sub) {
        throw new WsException('Not a participant in this ticket');
      }
      return ticket;
    }
    if (staffCanSeeTicket(actor, ticket)) {
      return ticket;
    }
    // A department-restricted operator still gets full access to a ticket
    // they were @mentioned on — see TicketMentionEntity's own comment.
    const mentionCount = await this.mentionsRepository.count({ where: { ticketId: ticket.id, userId: actor.sub } });
    if (mentionCount === 0) {
      throw new WsException('Not a participant in this ticket');
    }
    return ticket;
  }

  // A client only ever sees the public reply thread — internal comments are
  // staff-to-staff notes and must never reach this query for them. Staff see
  // both, mixed in their real chronological order.
  async getHistory(ticketId: string, actor: JwtPayload): Promise<PublicComment[]> {
    const comments = await this.commentsRepository.find({
      where: actor.role === UserRole.CLIENT ? { ticketId, isInternal: false } : { ticketId },
      order: { createdAt: 'ASC' },
    });
    return comments.map(toPublicComment);
  }

  // Author-only, regardless of role: an admin edits their own messages, not
  // anyone else's — "edit" here is "fix my own typo", not moderation. No
  // isInternal filter here (unlike getHistory) — an author can edit either
  // kind of their own message; getTicketForParticipant already gates who can
  // reach this at all, and the client never has an internal comment of
  // their own to try to edit in the first place.
  async editMessage(ticket: TicketEntity, actor: JwtPayload, commentId: string, body: string): Promise<PublicComment> {
    // Same rule as postMessage — a closed ticket is frozen for everyone,
    // editing a past message included. Reopening (status back to OPEN) is
    // the only way back in, same escape hatch for every role.
    if (ticket.status.isClosed) {
      throw new WsException('Тикет завершён — изменение сообщений недоступно');
    }
    // A trashed ticket is readable (getTicketForParticipant resolves it with
    // withDeleted) but frozen — restore it first to edit a message.
    if (ticket.deletedAt) {
      throw new WsException('Тикет в корзине — сначала восстановите его');
    }

    const comment = await this.commentsRepository.findOne({
      where: { id: commentId, ticketId: ticket.id },
    });
    if (!comment) {
      throw new WsException('Message not found');
    }
    if (comment.authorId !== actor.sub) {
      throw new WsException('Only the author can edit a message');
    }

    const previousBody = comment.body;
    comment.body = sanitizeCommentBody(body);
    comment.editedAt = new Date();
    const saved = await this.commentsRepository.save(comment);

    // Skip logging a no-op "edit" (re-submitting the same text) — same
    // guard tickets.service.ts uses before logging a field change.
    if (comment.body !== previousBody) {
      await this.activityRepository.save(
        this.activityRepository.create({
          ticketId: ticket.id,
          actorId: actor.sub,
          type: TicketActivityType.MESSAGE_EDITED,
          fromValue: previousBody,
          toValue: comment.body,
          // Carries the note's full text either way — TicketsService.getActivity
          // uses this flag to keep it out of a client's view exactly like
          // getHistory above already keeps the internal note itself out of it.
          internal: comment.isInternal,
        }),
      );
    }

    return toPublicComment(saved);
  }

  async postMessage(
    ticket: TicketEntity,
    actor: JwtPayload,
    body: string,
    isInternal: boolean,
  ): Promise<{ comment: PublicComment; mentionedUserIds: string[] }> {
    // A closed ticket is frozen — nothing new gets added or written by
    // anyone, staff included. Reopening (status back to OPEN) is the only
    // way back in; this rule applies uniformly rather than carving out an
    // admin/internal-note exception, so it stays simple to reason about.
    if (ticket.status.isClosed) {
      throw new WsException('Тикет завершён — новые сообщения недоступны');
    }
    // Same reasoning as editMessage above.
    if (ticket.deletedAt) {
      throw new WsException('Тикет в корзине — сначала восстановите его');
    }

    // Same gap as ticket-service's create() — the mandatory onboarding form
    // was only ever enforced client-side. A client can already HAVE a
    // ticket without having completed it (staff can file one on their
    // behalf), so this must be checked here too, not just at creation.
    if (actor.role === UserRole.CLIENT) {
      const client = await this.usersRepository.findOne({
        where: { id: actor.sub },
        select: ['id', 'profileCompletedAt'],
      });
      if (!client?.profileCompletedAt) {
        throw new WsException('Перед отправкой сообщения необходимо заполнить профиль');
      }
    }

    // A client can never post an internal note — enforced here, not just
    // hidden in the UI, regardless of what a raw socket call claims.
    const internal = isInternal && actor.role !== UserRole.CLIENT;
    const sanitizedBody = sanitizeCommentBody(body);

    const comment = this.commentsRepository.create({
      ticketId: ticket.id,
      authorId: actor.sub,
      body: sanitizedBody,
      isInternal: internal,
    });
    const saved = await this.commentsRepository.save(comment);

    // @mentions only ever come from the staff-only Mention extension in
    // operator-app — a client has no autocomplete for it, but a raw socket
    // call could still hand-craft the same span markup, so this is
    // enforced here too, not just by what the UI offers. A self-mention is
    // dropped rather than notifying the author about their own message.
    const mentionedUserIds =
      actor.role === UserRole.CLIENT ? [] : extractMentionedUserIds(sanitizedBody).filter((id) => id !== actor.sub);

    // Durable record for the department-restriction bypass (see
    // getTicketForParticipant above and the other staffCanSeeTicket call
    // sites) and the "Упоминания" sidebar folder — independent of, and
    // persisted before, the fire-and-forget MENTION notification enqueued
    // below. Idempotent: the same user can be mentioned again in a later
    // comment on this same ticket.
    //
    // The CommentEntity write above already succeeded — this insert can
    // still fail on a real FK violation (a raw socket call can hand-craft a
    // mention span with a made-up data-id; .orIgnore() only suppresses a
    // unique-constraint conflict, not a foreign-key one), and that must not
    // turn into a false "failed to send" ack for a message that's already
    // durably saved. Best-effort, same tradeoff as the Telegram relay below.
    if (mentionedUserIds.length > 0) {
      try {
        await this.mentionsRepository
          .createQueryBuilder()
          .insert()
          .into(TicketMentionEntity)
          .values(mentionedUserIds.map((userId) => ({ ticketId: ticket.id, userId })))
          .orIgnore()
          .execute();
      } catch (error) {
        this.logger.warn(
          `Failed to record mentions for comment ${saved.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    const notifiedUserIds = new Set<string>([actor.sub]);

    // Internal notes are staff-only by definition — never notify the
    // client who created the ticket, and skip notifying yourself.
    const recipientId = internal
      ? ticket.assignedTo !== actor.sub
        ? ticket.assignedTo
        : undefined
      : actor.role === UserRole.CLIENT
        ? ticket.assignedTo
        : ticket.createdBy;
    // Dedup bookkeeping (notifiedUserIds) stays synchronous and in order
    // below — only the actual enqueue() calls are deferred and fired
    // together at the end, so this reaches Redis once per recipient instead
    // of paying one round trip per recipient, sequentially, on every chat
    // message that has watchers or mentions.
    const notifications: Promise<unknown>[] = [];

    if (recipientId) {
      notifiedUserIds.add(recipientId);
      notifications.push(
        this.notificationsProducer.enqueue({ type: NotificationType.REPLY, userId: recipientId, ticketId: ticket.id }),
      );
    }

    // A mention is more specific than a generic reply — someone who's both
    // mentioned and would otherwise get a REPLY/watcher notification for
    // this same message only gets the MENTION one, not both.
    //
    // Same internal-note leak guard as recipientId/watchers above — the
    // mention picker is staff-only (operator-app's ChatPanel filters to
    // role !== 'client'), but nothing stops a hand-crafted comment body
    // (direct API call, or a stray mention span pasted from elsewhere) from
    // naming the ticket's own client. Without this check, an internal note
    // that happens to mention ticket.createdBy would notify the client —
    // by email — that staff are discussing them by name on a note they
    // were never meant to see.
    for (const mentionedId of mentionedUserIds) {
      if (notifiedUserIds.has(mentionedId)) continue;
      if (internal && mentionedId === ticket.createdBy) continue;
      notifiedUserIds.add(mentionedId);
      notifications.push(
        this.notificationsProducer.enqueue({ type: NotificationType.MENTION, userId: mentionedId, ticketId: ticket.id }),
      );
    }

    // "Следить" — any watcher of this ticket gets the same REPLY
    // notification as the assignee. Clients can now watch their own ticket
    // too (not just staff), so an internal note must skip the ticket's
    // creator specifically — the only client who could ever end up on this
    // watcher list (watch() enforces client-can-only-watch-own-ticket) —
    // the same leak this comment used to assume away entirely.
    const watchers = await this.watchersRepository.find({ where: { ticketId: ticket.id } });
    for (const watcher of watchers) {
      if (notifiedUserIds.has(watcher.userId)) continue;
      if (internal && watcher.userId === ticket.createdBy) continue;
      notifiedUserIds.add(watcher.userId);
      notifications.push(
        this.notificationsProducer.enqueue({ type: NotificationType.REPLY, userId: watcher.userId, ticketId: ticket.id }),
      );
    }

    // Same "comment is already saved, don't fail the ack over it" tradeoff
    // as the mentions insert above — a Redis/BullMQ hiccup here must delay
    // notifications, not tell the sender their already-persisted message
    // failed to send.
    try {
      await Promise.all(notifications);
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue one or more notifications for comment ${saved.id}: ${error instanceof Error ? error.message : error}`,
      );
    }

    // Only a genuine client reply on the public thread fires the Dispatcher
    // — an operator's own reply, and internal staff-only comments, aren't
    // "the client replied" from the automation engine's point of view. Same
    // best-effort tradeoff as above — the comment is already saved.
    if (actor.role === UserRole.CLIENT && !internal) {
      try {
        await this.automationTriggerProducer.enqueue(AutomationTrigger.CLIENT_REPLIED, ticket.id);
      } catch (error) {
        this.logger.warn(
          `Failed to enqueue automation trigger for comment ${saved.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    // Relay a genuine public staff reply back to the client's Telegram, for
    // ANY ticket they own — not just ones that originated on Telegram.
    // Once a client has linked Telegram, it's a second reachable channel for
    // every one of their tickets, the same way linking an email address
    // doesn't only forward replies on tickets that started as an email.
    // `internal` (not the raw `isInternal` param) respects the same
    // client-can-never-post-internal enforcement above, and the actor.role
    // check means a Telegram client's own message (which also flows through
    // postMessage) never echoes back to them.
    if (!internal && actor.role !== UserRole.CLIENT) {
      const client = await this.usersRepository.findOne({ where: { id: ticket.createdBy } });
      if (client?.telegramChatId) {
        // A client can now have replies from several tickets landing in the
        // same Telegram DM (not just the one "active" Telegram-channel
        // ticket the old channel-scoped gate implied), so every push names
        // its ticket and links straight to its detail view instead of
        // assuming the client already knows which conversation this is.
        const header = `<b>№${ticket.ticketNumber} — ${escapeTelegramHtml(ticket.title)}</b>\n`;
        const keyboard: TelegramInlineKeyboardMarkup = {
          // 'ticket:' mirrors telegram-ingestion.service.ts's own
          // TICKET_CALLBACK_PREFIX exactly — that service (a separate
          // deployable app, not reachable in-process) is what actually
          // handles the tap; duplicated here rather than shared for the
          // same reason ADMIN_APPROVE_PREFIX is duplicated between those
          // two files (see that constant's own comment).
          inline_keyboard: [
            [{ text: BOT_STRINGS[client.locale ?? Locale.RU].openTicketButton, callback_data: `ticket:${ticket.id}:m` }],
          ],
        };
        this.telegramOutbound.relay(client.telegramChatId, header + commentHtmlToTelegramHtml(sanitizedBody), keyboard);
      }
    }

    return { comment: toPublicComment(saved), mentionedUserIds };
  }
}
