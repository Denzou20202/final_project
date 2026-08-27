import {
  AutomationTriggerProducerService,
  escapeHtml,
  NotificationsProducerService,
  sanitizeCommentBody,
  SearchIndexProducerService,
} from '@veloxdesk/common';
import { CommentEntity, TicketActivityEntity, TicketEntity } from '@veloxdesk/database';
import {
  AutomationTrigger,
  NotificationType,
  TicketActivityType,
  TicketChannel,
  TicketPriority,
} from '@veloxdesk/types';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { Repository } from 'typeorm';
import { SlaPoliciesRepository } from '../sla/sla-policies.repository.js';
import { TicketEventsPublisherService } from '../ticket-events/ticket-events-publisher.service.js';
import { TicketStatusesRepository } from '../ticket-statuses/ticket-statuses.repository.js';
import { toPublicTicketStatus } from '../ticket-statuses/ticket-status.public.js';
import { TicketTypesRepository } from '../ticket-types/ticket-types.repository.js';
import { EmailUserResolverService } from './email-user-resolver.service.js';
import { extractThreadCandidates } from './thread-matching.js';

@Injectable()
export class EmailIngestionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EmailIngestionService.name);
  private isPolling = false;

  constructor(
    private readonly config: ConfigService,
    private readonly userResolver: EmailUserResolverService,
    private readonly notificationsProducer: NotificationsProducerService,
    private readonly ticketEventsPublisher: TicketEventsPublisherService,
    private readonly slaPoliciesRepository: SlaPoliciesRepository,
    private readonly searchIndexProducer: SearchIndexProducerService,
    private readonly automationTriggerProducer: AutomationTriggerProducerService,
    @InjectRepository(TicketEntity)
    private readonly ticketsRepository: Repository<TicketEntity>,
    @InjectRepository(CommentEntity)
    private readonly commentsRepository: Repository<CommentEntity>,
    @InjectRepository(TicketActivityEntity)
    private readonly activityRepository: Repository<TicketActivityEntity>,
    private readonly ticketStatusesRepository: TicketStatusesRepository,
    private readonly ticketTypesRepository: TicketTypesRepository,
  ) {}

  onApplicationBootstrap(): void {
    // Also run once at startup rather than waiting for the first interval tick.
    void this.poll();
  }

  @Interval('email-ingestion-poll', 15_000)
  handleInterval(): void {
    void this.poll();
  }

  private async poll(): Promise<void> {
    if (this.isPolling) {
      return;
    }
    this.isPolling = true;

    const client = new ImapFlow({
      host: this.config.get<string>('IMAP_HOST', 'localhost'),
      port: this.config.get<number>('IMAP_PORT', 3143),
      secure: this.config.get<string>('IMAP_SECURE', 'false') === 'true',
      auth: {
        user: this.config.getOrThrow<string>('IMAP_USER'),
        pass: this.config.getOrThrow<string>('IMAP_PASS'),
      },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        await this.processUnseenMessages(client);
      } finally {
        lock.release();
      }
    } catch (error) {
      this.logger.error('Failed to poll the support mailbox', error instanceof Error ? error.stack : String(error));
    } finally {
      await client.logout().catch(() => undefined);
      this.isPolling = false;
    }
  }

  private async processUnseenMessages(client: ImapFlow): Promise<void> {
    const uids = await client.search({ seen: false }, { uid: true });
    if (!uids || uids.length === 0) {
      return;
    }

    // Fetching messages one at a time (rather than streaming the whole batch
    // via client.fetch()) is deliberate: against a flaky IMAP server the
    // multi-message stream can die mid-batch, silently dropping whichever
    // message was mid-flight with no per-message error logged. A dead
    // batch here just means the rest wait for the next poll tick.
    for (const uid of uids) {
      try {
        const message = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (!message || !message.source) {
          this.logger.warn(`Message uid=${uid} had no source, skipping`);
          // Nothing will ever change for a source-less message, so it's safe
          // — and necessary, to stop polling it forever — to mark it seen.
          await this.markSeen(client, uid);
          continue;
        }
        await this.processMessage(message.source);
        // Only flag \Seen once processing actually succeeded. A transient
        // failure here (DB blip, S3 down, etc.) used to still get flagged
        // seen unconditionally in a `finally` — the message was never
        // retried and silently lost. Leaving it unseen means the next poll
        // (15s later) picks it back up; a deterministically-failing message
        // just keeps erroring loudly in the logs instead of vanishing.
        await this.markSeen(client, uid);
      } catch (error) {
        this.logger.error(
          `Failed to process inbound message uid=${uid}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  // imapflow's `range` param wants number[] | SequenceString | SearchObject —
  // a bare uid number is silently mishandled, so the flag never sticks and
  // the same message gets reprocessed (and re-fails) forever.
  private async markSeen(client: ImapFlow, uid: number): Promise<void> {
    await client.messageFlagsAdd([uid], ['\\Seen'], { uid: true }).catch((error) => {
      this.logger.warn(`Failed to flag uid=${uid} as seen: ${error instanceof Error ? error.message : error}`);
    });
  }

  private async processMessage(source: Buffer): Promise<void> {
    const parsed = await simpleParser(source);

    const fromAddress = parsed.from?.value[0]?.address;
    if (!fromAddress) {
      this.logger.warn('Skipping inbound message with no parseable From address');
      return;
    }

    const messageId = parsed.messageId ?? undefined;
    const threadCandidates = extractThreadCandidates(
      parsed.inReplyTo,
      parsed.references as string | string[] | undefined,
    );
    // parsed.text is genuine plain text from an unauthenticated sender (the
    // support mailbox needs no auth to email) — a literal `<img
    // src=x onerror="...">` typed as ordinary characters must render as
    // that literal text, not get interpreted as markup once the frontend
    // puts comment.body/description into dangerouslySetInnerHTML. Escape
    // first (same two-step pattern telegram-ingestion uses for its own
    // plain-text path via telegramEntitiesToHtml), then sanitizeCommentBody
    // like every other comment.body/description write in this codebase.
    const body = sanitizeCommentBody(escapeHtml((parsed.text ?? '').trim() || '(пустое письмо)'));
    const subject = parsed.subject?.trim() || '(без темы)';

    const sender = await this.userResolver.findOrCreateByEmail(fromAddress, parsed.from?.value[0]?.name);
    if (!sender) {
      // A staff (or deactivated) account already owns this address — see
      // findOrCreateByEmail's own comment. Dropping silently (not throwing)
      // is deliberate: throwing here would leave the message unflagged
      // \Seen, and the exact same forged/stale From: keeps re-arriving on
      // every 15s poll forever.
      this.logger.warn(`Skipping inbound message from ${fromAddress} — not a client mailbox`);
      return;
    }

    // IMAP's \Seen flag is best-effort, not transactional with our DB write —
    // if the connection drops between creating the ticket and flagging the
    // message (Greenmail does this occasionally), the same message comes
    // back as unseen on the next poll. Looking the message's own Message-ID
    // up alongside the reply-thread candidates makes reprocessing a no-op
    // instead of a duplicate-ticket crash.
    // A reply to an old thread whose ticket has since been closed must not
    // silently reopen/append to it — a closed ticket is frozen (same rule
    // postMessage()/editMessage() enforce for chat). Falling through to the
    // no-match branch below opens a fresh ticket instead, same as any other
    // first-contact message. Mirrors telegram-ingestion.service.ts's
    // equivalent thread-matching query.
    const lookupIds = messageId ? [...threadCandidates, messageId] : threadCandidates;
    const existingTicket = lookupIds.length
      ? await this.ticketsRepository
          .createQueryBuilder('ticket')
          .leftJoinAndSelect('ticket.status', 'status')
          .where('ticket.externalThreadId IN (:...ids)', { ids: lookupIds })
          .andWhere('status.isClosed = false')
          .getOne()
      : null;

    if (existingTicket && messageId && existingTicket.externalThreadId === messageId) {
      this.logger.debug(`Message ${messageId} was already processed into ticket ${existingTicket.id}, skipping`);
      return;
    }

    // externalThreadId is only ever set by createTicketFromEmail below, so
    // any match here always traces back to the client who originally
    // opened it — verifying that against the resolved sender closes off
    // hijacking a stranger's thread: In-Reply-To/References just echo a
    // Message-ID the whole thread already saw (any participant who was
    // CC'd, or who simply forwards the email, can read and replay it), and
    // there's nothing else authenticating this message as coming from the
    // conversation's actual owner. A mismatch falls through to the same
    // "no match" branch as any unrelated first-contact message — a fresh
    // ticket for the sender's own account, not an append into someone
    // else's.
    if (existingTicket && existingTicket.createdBy === sender.id) {
      await this.appendReply(existingTicket, sender.id, body);
    } else {
      await this.createTicketFromEmail(sender.id, subject, body, messageId);
    }
  }

  private async appendReply(ticket: TicketEntity, authorId: string, body: string): Promise<void> {
    const comment = this.commentsRepository.create({
      ticketId: ticket.id,
      authorId,
      body,
      isInternal: false,
    });
    await this.commentsRepository.save(comment);

    if (ticket.assignedTo) {
      await this.notificationsProducer.enqueue({
        type: NotificationType.REPLY,
        userId: ticket.assignedTo,
        ticketId: ticket.id,
      });
    }
    await this.ticketEventsPublisher.publish({
      type: 'reply',
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      status: toPublicTicketStatus(ticket.status),
      teamId: ticket.teamId,
      assignedTo: ticket.assignedTo,
      createdBy: ticket.createdBy,
    });
    await this.searchIndexProducer.enqueueTicket(ticket.id);

    this.logger.log(`Appended email reply as a comment on ticket ${ticket.id}`);
  }

  private async createTicketFromEmail(
    createdBy: string,
    title: string,
    description: string,
    externalThreadId: string | undefined,
  ): Promise<void> {
    // Mirrors TicketsService.create() — an email-filed ticket must get the
    // same SLA policy, search-index entry, and TICKET_CREATED automation
    // trigger as one filed through the API, or it silently never breaches
    // (SlaEscalationRepository's queries join on slaPolicy and skip nulls),
    // never shows up in search, and any "on create" automation rule (e.g.
    // auto-assign) never fires for it.
    const priority = TicketPriority.MEDIUM;
    const [slaPolicy, defaultStatus, defaultType] = await Promise.all([
      this.slaPoliciesRepository.findByPriority(priority),
      this.ticketStatusesRepository.findDefault(),
      this.ticketTypesRepository.findDefault(),
    ]);
    if (!defaultStatus) {
      this.logger.error('No default ticket status configured — skipping email-ingested ticket creation');
      return;
    }
    if (!defaultType) {
      this.logger.error('No default ticket type configured — skipping email-ingested ticket creation');
      return;
    }

    const ticket = this.ticketsRepository.create({
      title,
      description,
      statusId: defaultStatus.id,
      priority,
      typeId: defaultType.id,
      channel: TicketChannel.EMAIL,
      createdBy,
      externalThreadId: externalThreadId ?? null,
      slaPolicyId: slaPolicy?.id ?? null,
    });
    const saved = await this.ticketsRepository.save(ticket);

    const activity = this.activityRepository.create({
      ticketId: saved.id,
      actorId: createdBy,
      type: TicketActivityType.CREATED,
      toValue: defaultStatus.name,
    });
    await this.activityRepository.save(activity);

    // ticket_number is a raw-SQL sequence default (see ticket.entity.ts) —
    // TypeORM has no column metadata for it, so save()'s return value has it
    // as undefined even though the row itself is correct. Re-fetch first.
    const created = await this.ticketsRepository.findOne({ where: { id: saved.id }, relations: ['status'] });
    // Three independent side effects — mirrors TicketsService.create()'s own
    // Promise.all for the same reasoning.
    await Promise.all([
      this.ticketEventsPublisher.publish({
        type: 'created',
        ticketId: saved.id,
        ticketNumber: created?.ticketNumber ?? saved.ticketNumber,
        title: saved.title,
        status: toPublicTicketStatus(created?.status ?? defaultStatus),
        teamId: saved.teamId,
        assignedTo: saved.assignedTo,
        createdBy: saved.createdBy,
      }),
      this.searchIndexProducer.enqueueTicket(saved.id),
      this.automationTriggerProducer.enqueue(AutomationTrigger.TICKET_CREATED, saved.id),
    ]);

    this.logger.log(`Created ticket ${saved.id} from inbound email`);
  }
}
