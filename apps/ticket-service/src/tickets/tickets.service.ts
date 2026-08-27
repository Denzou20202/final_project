import {
  AutomationTriggerProducerService,
  computeStaffRestrictions,
  JwtPayload,
  NotificationsProducerService,
  sanitizeCommentBody,
  SearchIndexProducerService,
  staffCanSeeTicket,
} from '@veloxdesk/common';
import {
  AttachmentEntity,
  CommentEntity,
  PermissionGroupEntity,
  TeamEntity,
  TicketActivityEntity,
  TicketCustomFieldValueEntity,
  TicketEntity,
  TicketMentionEntity,
  TicketStatusEntity,
  TicketTagEntity,
  TicketWatcherEntity,
  UserEntity,
} from '@veloxdesk/database';
import {
  AutomationTrigger,
  NotificationType,
  SortOrder,
  SYSTEM_USER_ID,
  TicketActivityType,
  TicketEventPayload,
  TicketPriority,
  TicketSortField,
  UserRole,
} from '@veloxdesk/types';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { S3Service } from '../attachments/s3.service.js';
import { CsatService } from '../csat/csat.service.js';
import { SlaPoliciesRepository } from '../sla/sla-policies.repository.js';
import { TelegramCsatNotifyService } from '../telegram-notify/telegram-csat-notify.service.js';
import { TicketCategoriesRepository } from '../ticket-categories/ticket-categories.repository.js';
import { TicketEventsPublisherService } from '../ticket-events/ticket-events-publisher.service.js';
import { TicketStatusesRepository } from '../ticket-statuses/ticket-statuses.repository.js';
import { toPublicTicketStatus } from '../ticket-statuses/ticket-status.public.js';
import { TicketTypesRepository } from '../ticket-types/ticket-types.repository.js';
import { AssignCategoryDto } from './dto/assign-category.dto.js';
import { AssignTeamDto } from './dto/assign-team.dto.js';
import { AssignTicketDto } from './dto/assign-ticket.dto.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto.js';
import { MergeTicketDto } from './dto/merge-ticket.dto.js';
import { TicketCountsQueryDto } from './dto/ticket-counts-query.dto.js';
import { UpdatePriorityDto } from './dto/update-priority.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { UpdateTicketDto } from './dto/update-ticket.dto.js';
import { escalatePriority } from './sla-escalation/escalate-priority.js';
import { stripHtml } from './strip-html.js';
import { TicketActivityRepository } from './ticket-activity.repository.js';
import { decodeTicketListCursor, encodeTicketListCursor } from './ticket-list-cursor.js';
import { PublicCreatedTicket, PublicTeamTicketCounts, PublicTicket, PublicTicketActivity, PublicTicketCounts, PublicTicketPage, toPublicActivity, toPublicTicket } from './ticket.public.js';
import { ticketSortValue, TicketFilters, TicketsRepository } from './tickets.repository.js';

const DEFAULT_PAGE_SIZE = 20;

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly ticketsRepository: TicketsRepository,
    private readonly activityRepository: TicketActivityRepository,
    private readonly notificationsProducer: NotificationsProducerService,
    private readonly ticketEventsPublisher: TicketEventsPublisherService,
    private readonly searchIndexProducer: SearchIndexProducerService,
    private readonly slaPoliciesRepository: SlaPoliciesRepository,
    private readonly automationTriggerProducer: AutomationTriggerProducerService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(TeamEntity)
    private readonly teamsRepository: Repository<TeamEntity>,
    @InjectRepository(CommentEntity)
    private readonly commentsRepository: Repository<CommentEntity>,
    @InjectRepository(PermissionGroupEntity)
    private readonly permissionGroupsRepository: Repository<PermissionGroupEntity>,
    private readonly csatService: CsatService,
    private readonly telegramCsatNotifyService: TelegramCsatNotifyService,
    private readonly ticketCategoriesRepository: TicketCategoriesRepository,
    private readonly ticketStatusesRepository: TicketStatusesRepository,
    private readonly ticketTypesRepository: TicketTypesRepository,
    private readonly s3Service: S3Service,
  ) {}

  async create(dto: CreateTicketDto, actor: JwtPayload): Promise<PublicCreatedTicket> {
    // The mandatory onboarding form (OnboardingModal, client-portal) was
    // only ever enforced client-side — a client with a valid access token
    // could call this endpoint directly and create tickets without ever
    // completing it. JwtPayload doesn't carry profileCompletedAt (computed
    // once at login, and this must reflect the CURRENT value, same reason
    // JwtStrategy re-checks deactivation live instead of trusting the
    // token), so this is its own small live lookup.
    if (actor.role === UserRole.CLIENT) {
      const client = await this.usersRepository.findOne({
        where: { id: actor.sub },
        select: ['id', 'profileCompletedAt'],
      });
      if (!client?.profileCompletedAt) {
        throw new BadRequestException('Перед созданием обращения необходимо заполнить профиль');
      }
    }

    // Only staff can choose a priority at creation time — a client always
    // gets MEDIUM regardless of what the request body says, the same way
    // `onBehalfOf` below is ignored for a client actor. Enforced here, not
    // just hidden in the client-portal form, so a direct API call can't
    // bypass it.
    const priority = actor.role === UserRole.CLIENT ? TicketPriority.MEDIUM : (dto.priority ?? TicketPriority.MEDIUM);
    const slaPolicy = await this.slaPoliciesRepository.findByPriority(priority);

    // Staff logging a ticket on a client's behalf (e.g. a phone call) — the
    // client passed here becomes `createdBy` so every ownership check,
    // notification and the ticket's own «Клиент» panel treat the ticket
    // exactly as if that client had submitted it themselves. `onBehalfOf` is
    // ignored for a client actor — they can only ever create as themselves.
    let createdBy = actor.sub;
    let createdOnBehalfBy: string | null = null;
    if (dto.onBehalfOf && actor.role !== UserRole.CLIENT) {
      const client = await this.usersRepository.findOne({ where: { id: dto.onBehalfOf } });
      if (!client || client.role !== UserRole.CLIENT) {
        throw new BadRequestException('Client not found');
      }
      createdBy = client.id;
      createdOnBehalfBy = actor.sub;
    }

    // Optional for every role — a request naming an id that doesn't exist in
    // the admin-managed catalog is rejected outright rather than silently
    // dropped, the same way onBehalfOf above 400s on an unknown client.
    if (dto.categoryId) {
      const category = await this.ticketCategoriesRepository.findById(dto.categoryId);
      if (!category) {
        throw new BadRequestException('Category not found');
      }
    }

    if (dto.typeId) {
      const type = await this.ticketTypesRepository.findById(dto.typeId);
      if (!type) {
        throw new BadRequestException('Ticket type not found');
      }
    }

    const sanitizedDescription = sanitizeCommentBody(dto.description);

    const ticket = await this.ticketsRepository.create({
      title: dto.title,
      description: sanitizedDescription,
      priority,
      typeId: dto.typeId,
      createdBy,
      createdOnBehalfBy,
      slaPolicyId: slaPolicy?.id ?? null,
      categoryId: dto.categoryId ?? null,
    });

    // The description is what the client actually said to explain their
    // problem — it belongs in the conversation as the opening message,
    // attributed to them, not as a caption under the ticket header.
    // `description` itself stays on the ticket row too (list-view previews,
    // search, export all read it from there), this just ALSO surfaces it in
    // the chat thread.
    const descriptionComment = await this.commentsRepository.save(
      this.commentsRepository.create({
        ticketId: ticket.id,
        authorId: createdBy,
        body: sanitizedDescription,
        isInternal: false,
      }),
    );

    // Re-fetch rather than trusting the insert result directly (same as
    // every other mutation in this service) — `ticket_number` is populated
    // by a raw-SQL sequence default that TypeORM has no column metadata
    // for, so the object `save()` hands back has it as `undefined` even
    // though the row itself is correct. The publish below needs the real
    // number (and the CREATED log below needs the loaded `status` relation
    // for its human-readable toValue), so this has to happen before both.
    const created = await this.getTicketOrThrow(ticket.id);

    await this.activityRepository.log({
      ticketId: ticket.id,
      actorId: actor.sub,
      type: TicketActivityType.CREATED,
      toValue: created.status.name,
    });

    // Three independent side effects — none reads another's result, so
    // running them concurrently instead of one at a time halves this
    // endpoint's latency (same reasoning as updateStatus/updatePriority/
    // assign above).
    await Promise.all([
      this.ticketEventsPublisher.publish({
        type: 'created',
        ticketId: ticket.id,
        ticketNumber: created.ticketNumber,
        title: ticket.title,
        status: toPublicTicketStatus(created.status),
        teamId: created.teamId,
        assignedTo: created.assignedTo,
        createdBy: created.createdBy,
        // No-op when a client files their own ticket (they're not in the
        // operators room anyway); when staff file on a client's behalf, this
        // keeps them from being notified about their own action.
        excludeUserId: actor.sub,
      }),
      this.searchIndexProducer.enqueueTicket(ticket.id),
      this.automationTriggerProducer.enqueue(AutomationTrigger.TICKET_CREATED, ticket.id),
    ]);

    return { ...toPublicTicket(created), descriptionCommentId: descriptionComment.id };
  }

  async findOne(id: string, actor: JwtPayload): Promise<PublicTicket> {
    const ticket = await this.getOwnedTicketOrThrow(id, actor, true);
    return toPublicTicket(ticket);
  }

  // Staff-only lookup by the short human-facing number — backs the merge
  // UI's "find target ticket" step. Never reachable by a client (gated at
  // the controller), but the actor's own permission-group restrictions
  // still apply: ticket numbers are sequential and trivially guessable,
  // so without this check they'd be an enumeration side door around the
  // department/own-tickets scoping.
  async findByNumber(ticketNumber: number, actor: JwtPayload): Promise<PublicTicket> {
    const ticket = await this.ticketsRepository.findByNumber(ticketNumber);
    if (!ticket || !staffCanSeeTicket(actor, ticket)) {
      throw new NotFoundException('Ticket not found');
    }
    return toPublicTicket(ticket);
  }

  // Exposed for other modules (attachments, tags) that need the same
  // access check — a client sees a 404 for tickets they don't own, staff
  // see a 404 for tickets outside their permission-group scope.
  assertAccess(id: string, actor: JwtPayload, includeDeleted = false) {
    return this.getOwnedTicketOrThrow(id, actor, includeDeleted);
  }

  async list(query: ListTicketsQueryDto, actor: JwtPayload): Promise<PublicTicketPage> {
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const sort = { field: query.sortBy ?? TicketSortField.CREATED_AT, order: query.sortOrder ?? SortOrder.DESC };
    const after = query.cursor ? this.parseCursor(query.cursor) : undefined;

    // Clients only ever see their own tickets — enforced server-side, not by
    // trusting a query param, regardless of what the client passes. The
    // watching filter applies to them too (scoped to their own watch rows),
    // since clients can follow their own tickets via «Под контролем» —
    // dropping it here would silently return ALL their tickets under that
    // folder.
    const filters =
      actor.role === UserRole.CLIENT
        ? {
            statusId: query.statusId,
            priority: query.priority,
            // 'unassigned'/'assigned' sentinels power client-portal's own
            // «Новые»/«В работе» split (an internal assignment fact, but
            // harmless to filter by — createdBy below already confines the
            // result to the client's own tickets either way).
            assignedTo: query.assignedTo,
            createdBy: actor.sub,
            teamId: query.teamId,
            tagId: query.tagId,
            watcherId: query.watching === 'me' ? actor.sub : undefined,
            search: query.search,
            createdFrom: query.createdFrom ? new Date(query.createdFrom) : undefined,
            createdTo: query.createdTo ? new Date(query.createdTo) : undefined,
          }
        : {
            statusId: query.statusId,
            priority: query.priority,
            assignedTo: query.assignedTo,
            teamId: query.teamId,
            createdBy: query.createdBy,
            tagId: query.tagId,
            watcherId: query.watching === 'me' ? actor.sub : undefined,
            mentionedId: query.mentioned === 'me' ? actor.sub : undefined,
            search: query.search,
            createdFrom: query.createdFrom ? new Date(query.createdFrom) : undefined,
            createdTo: query.createdTo ? new Date(query.createdTo) : undefined,
            // Mentions deliberately bypass department/own-tickets scoping —
            // the whole point of this folder is surfacing tickets OUTSIDE
            // the operator's normal restrictions (see TicketMentionEntity's
            // comment). Watching stays restriction-compatible on purpose:
            // you can only watch what you could already see.
            ...(query.mentioned === 'me' ? {} : this.staffRestrictions(actor)),
          };

    const rows = await this.ticketsRepository.findPage(limit, filters, sort, after);

    const hasNextPage = rows.length > limit;
    const page = hasNextPage ? rows.slice(0, limit) : rows;
    const lastRow = page.at(-1);

    return {
      items: page.map(toPublicTicket),
      nextCursor:
        hasNextPage && lastRow
          ? encodeTicketListCursor({ sortValue: ticketSortValue(lastRow, sort.field), id: lastRow.id })
          : null,
    };
  }

  async getCounts(query: TicketCountsQueryDto, actor: JwtPayload): Promise<PublicTicketCounts> {
    // Same client-scoping rules as list() above — including the watching
    // filter, so the client's «Под контролем» badge counts only tickets
    // they actually watch, not everything they own.
    const filters =
      actor.role === UserRole.CLIENT
        ? {
            priority: query.priority,
            assignedTo: query.assignedTo,
            createdBy: actor.sub,
            teamId: query.teamId,
            tagId: query.tagId,
            watcherId: query.watching === 'me' ? actor.sub : undefined,
            search: query.search,
          }
        : {
            priority: query.priority,
            assignedTo: query.assignedTo,
            teamId: query.teamId,
            tagId: query.tagId,
            watcherId: query.watching === 'me' ? actor.sub : undefined,
            mentionedId: query.mentioned === 'me' ? actor.sub : undefined,
            search: query.search,
            ...(query.mentioned === 'me' ? {} : this.staffRestrictions(actor)),
          };

    const byStatus = await this.ticketsRepository.getCounts(filters);
    const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);
    return { total, byStatus };
  }

  // Staff-only — client-portal's sidebar has no per-team/per-tag breakdown.
  // One request each instead of the sidebar firing useTicketCounts(teamId)/
  // (tagId) per rendered item. The three underlying queries are independent
  // reads over the same restriction set, so they run in parallel.
  async getCountsByTeam(actor: JwtPayload): Promise<Record<string, PublicTeamTicketCounts>> {
    const restrictions = this.staffRestrictions(actor);
    const [byTeam, unassignedByTeam, byTeamAssignee] = await Promise.all([
      this.ticketsRepository.getCountsByTeam(restrictions),
      this.ticketsRepository.getUnassignedCountsByTeam(restrictions),
      this.ticketsRepository.getCountsByTeamAndAssignee(restrictions),
    ]);
    const base = this.toPublicCountsMap(byTeam);
    return Object.fromEntries(
      Object.entries(base).map(([teamId, counts]) => [
        teamId,
        {
          ...counts,
          unassigned: unassignedByTeam[teamId] ?? 0,
          byAssignee: this.toPublicCountsMap(byTeamAssignee[teamId] ?? {}),
        },
      ]),
    );
  }

  async getCountsByTag(actor: JwtPayload): Promise<Record<string, PublicTicketCounts>> {
    const byTag = await this.ticketsRepository.getCountsByTag(this.staffRestrictions(actor));
    return this.toPublicCountsMap(byTag);
  }

  private toPublicCountsMap(
    grouped: Record<string, Record<string, number>>,
  ): Record<string, PublicTicketCounts> {
    return Object.fromEntries(
      Object.entries(grouped).map(([key, byStatus]) => [
        key,
        { total: Object.values(byStatus).reduce((sum, n) => sum + n, 0), byStatus },
      ]),
    );
  }

  // Mandatory permission-group restrictions layered on top of a staff
  // member's own choice of filters — see computeStaffRestrictions
  // (libs/common) for how these fields land on the actor at login/refresh,
  // and tickets.repository.ts (applyRestrictions) for how they're actually
  // enforced in SQL. Clients never reach this — they're scoped by createdBy
  // alone, above.
  private staffRestrictions(actor: JwtPayload): Pick<TicketFilters, 'restrictDepartmentIds' | 'restrictToUserId'> {
    return computeStaffRestrictions(actor);
  }

  async update(id: string, dto: UpdateTicketDto, actor: JwtPayload): Promise<PublicTicket> {
    const ticket = await this.getOwnedTicketOrThrow(id, actor);

    // Up to 3 activity-log entries (different fields, same row) — collected
    // as data rather than fired individually, so they land in the same
    // transaction as the ticket write below.
    type EditEntry = { ticketId: string; actorId: string; type: TicketActivityType; field: string; fromValue: string | null; toValue: string | null };
    const edits: EditEntry[] = [];
    if (dto.title !== undefined && dto.title !== ticket.title) {
      edits.push({
        ticketId: id,
        actorId: actor.sub,
        type: TicketActivityType.EDITED,
        field: 'title',
        fromValue: ticket.title,
        toValue: dto.title,
      });
    }
    if (dto.description !== undefined && dto.description !== ticket.description) {
      edits.push({
        ticketId: id,
        actorId: actor.sub,
        type: TicketActivityType.EDITED,
        field: 'description',
        fromValue: ticket.description,
        toValue: dto.description,
      });
    }
    if (dto.typeId !== undefined && dto.typeId !== ticket.typeId) {
      const type = await this.ticketTypesRepository.findById(dto.typeId);
      if (!type) {
        throw new BadRequestException('Ticket type not found');
      }
      edits.push({
        ticketId: id,
        actorId: actor.sub,
        type: TicketActivityType.EDITED,
        field: 'type',
        // Type id, not the display name — same reasoning as
        // updateStatus()'s STATUS_CHANGED entries below: a name is a single
        // fixed string that could never translate for the audit log. The
        // frontend resolves this id against the current types list and
        // picks the right locale at render time.
        fromValue: ticket.typeId,
        toValue: dto.typeId,
      });
    }

    // The ticket write and its activity-log entries land atomically — same
    // reasoning as assign()/updateStatus() above.
    await this.dataSource.transaction(async (manager) => {
      await manager.update(TicketEntity, { id }, { title: dto.title, description: dto.description, typeId: dto.typeId });
      if (edits.length > 0) {
        await manager.insert(TicketActivityEntity, edits);
      }
    });
    await this.searchIndexProducer.enqueueTicket(id);
    const updated = await this.getTicketOrThrow(id);
    await this.broadcastTicketUpdated(updated, actor.sub);
    return toPublicTicket(updated);
  }

  async updateStatus(id: string, dto: UpdateStatusDto, actor: JwtPayload): Promise<PublicTicket> {
    const ticket = await this.getOwnedTicketOrThrow(id, actor);
    const targetStatus = await this.ticketStatusesRepository.findById(dto.statusId);
    if (!targetStatus) {
      throw new BadRequestException('Ticket status not found');
    }
    this.assertAssignedForClose(ticket, targetStatus);

    if (targetStatus.id === ticket.statusId) {
      return toPublicTicket(ticket);
    }

    // Self-assign on pickup — whoever changes the status of an unassigned
    // ticket becomes its assignee, same as if they'd used the assignee
    // picker themselves (mirrors the check in assign()). Used to be gated to
    // the old NEW -> OPEN transition specifically; tickets no longer have a
    // distinct "just created" status, so any status change on an unclaimed
    // ticket now counts as picking it up.
    const shouldSelfAssign = !ticket.assignedTo && !actor.cannotBeAssignee;

    const closedAt = targetStatus.isClosed
      ? new Date()
      : ticket.status.isClosed
        ? null
        : (ticket.closedAt ?? null);

    // Self-assign (if any) + the status write + both activity-log entries
    // happen atomically — a failure partway through (e.g. the status UPDATE
    // erroring right after self-assign already landed) used to be able to
    // leave the ticket claimed by an operator whose status-change request
    // had actually failed, with no STATUS_CHANGED entry to show for it.
    await this.dataSource.transaction(async (manager) => {
      // Row-locked re-read, immediately before any write in this
      // transaction — captures fromValue atomically with the UPDATE below,
      // closing the read-then-write race where a concurrent status change
      // on this same ticket could land between the pre-transaction read
      // above and this write, making `ticket.status.id` stale. Same
      // pessimistic_write idiom merge() already uses for its own
      // TOCTOU-sensitive re-check — FOR UPDATE blocks until any in-flight
      // writer on this row commits/rolls back, then reads the real,
      // just-committed state. (RETURNING on the UPDATE below can't
      // substitute for this — Postgres RETURNING always reflects the
      // POST-update row, never the pre-update value.)
      const locked = await manager
        .createQueryBuilder(TicketEntity, 'ticket')
        .setLock('pessimistic_write')
        .where('ticket.id = :id', { id })
        .getOne();
      if (!locked) {
        throw new NotFoundException('Ticket not found');
      }

      if (shouldSelfAssign) {
        // Conditional on assigned_to still being NULL — two operators
        // opening this same unassigned ticket and changing its status
        // within the same read window both reach this branch, but only
        // whichever write lands first actually claims it; the loser's
        // write affects zero rows, so it skips logging an ASSIGNED
        // activity for an assignment that didn't actually happen instead
        // of leaving a contradictory entry.
        const result = await manager.update(TicketEntity, { id, assignedTo: IsNull() }, { assignedTo: actor.sub });
        if ((result.affected ?? 0) > 0) {
          await manager.insert(TicketActivityEntity, {
            ticketId: id,
            actorId: actor.sub,
            type: TicketActivityType.ASSIGNED,
            fromValue: null,
            toValue: actor.sub,
          });
        }
      }

      await manager.update(TicketEntity, { id }, { statusId: targetStatus.id, closedAt });
      // Status ID, not the display name — a name is a single fixed string,
      // so it could never translate for the audit log (TicketAuditModal's
      // ticketStatus.<key> lookup only ever matches the 4 seed statuses'
      // keys, never a name, and never anything for an admin-created custom
      // status at all). The frontend resolves this id against the current
      // statuses list and picks the right locale at render time; a
      // since-deleted status id just falls back to showing the raw id.
      await manager.insert(TicketActivityEntity, {
        ticketId: id,
        actorId: actor.sub,
        type: TicketActivityType.STATUS_CHANGED,
        fromValue: locked.statusId,
        toValue: targetStatus.id,
      });
    });
    // Three independent side effects (search reindex, automation trigger,
    // CSAT survey) — external, not DB writes a transaction can help with, so
    // they stay outside it and still run concurrently once the status change
    // itself is committed.
    await Promise.all([
      this.searchIndexProducer.enqueueTicket(id),
      this.automationTriggerProducer.enqueue(AutomationTrigger.STATUS_CHANGED, id),
      ...(targetStatus.isClosed ? [this.csatService.ensureSurveyForTicket(id)] : []),
    ]);

    const updated = await this.getTicketOrThrow(id);
    await this.broadcastTicketUpdated(updated, actor.sub);
    if (targetStatus.isClosed) {
      await this.telegramCsatNotifyService.notifyTicketClosed(updated);
    }
    return toPublicTicket(updated);
  }

  // Generalizes the old fixed "cannot close an unassigned ticket" rule to
  // any status flagged isClosed — a custom status an admin also marks
  // isClosed carries the same requirement. Defense in depth:
  // TicketAttributesPanel.tsx already disables the option client-side.
  private assertAssignedForClose(ticket: TicketEntity, targetStatus: TicketStatusEntity): void {
    if (targetStatus.isClosed && !ticket.assignedTo) {
      throw new BadRequestException(
        `Нельзя установить статус «${targetStatus.name}» — сначала назначьте исполнителя.`,
      );
    }
  }

  async updatePriority(id: string, dto: UpdatePriorityDto, actor: JwtPayload): Promise<PublicTicket> {
    const ticket = await this.getOwnedTicketOrThrow(id, actor);

    if (dto.priority === ticket.priority) {
      return toPublicTicket(ticket);
    }

    // Re-picks the policy for the new priority — the SLA clock still runs
    // from the ticket's original createdAt (see SlaEscalationService), so
    // re-labeling priority can't be used to buy more time.
    const slaPolicy = await this.slaPoliciesRepository.findByPriority(dto.priority);
    await this.dataSource.transaction(async (manager) => {
      // Same fromValue-atomicity idiom as updateStatus() above, for
      // `priority`.
      const locked = await manager
        .createQueryBuilder(TicketEntity, 'ticket')
        .setLock('pessimistic_write')
        .where('ticket.id = :id', { id })
        .getOne();
      if (!locked) {
        throw new NotFoundException('Ticket not found');
      }

      await manager.update(TicketEntity, { id }, { priority: dto.priority, slaPolicyId: slaPolicy?.id ?? null });
      await manager.insert(TicketActivityEntity, {
        ticketId: id,
        actorId: actor.sub,
        type: TicketActivityType.PRIORITY_CHANGED,
        fromValue: locked.priority,
        toValue: dto.priority,
      });
    });
    await Promise.all([
      this.searchIndexProducer.enqueueTicket(id),
      this.automationTriggerProducer.enqueue(AutomationTrigger.PRIORITY_CHANGED, id),
    ]);

    const updated = await this.getTicketOrThrow(id);
    await this.broadcastTicketUpdated(updated, actor.sub);
    return toPublicTicket(updated);
  }

  async assign(id: string, dto: AssignTicketDto, actor: JwtPayload): Promise<PublicTicket> {
    const ticket = await this.getOwnedTicketOrThrow(id, actor);
    // Same no-op guard updateStatus/updatePriority/applyAutomatedAssignee
    // all have — re-assigning to the current assignee used to still log an
    // activity row, enqueue a notification, and republish a ticket event.
    if (dto.assigneeId === ticket.assignedTo) {
      return toPublicTicket(ticket);
    }

    const assignee = await this.usersRepository.findOne({ where: { id: dto.assigneeId } });
    if (!assignee) {
      throw new NotFoundException('Assignee not found');
    }
    if (assignee.role === UserRole.CLIENT) {
      throw new BadRequestException('Cannot assign a ticket to a client');
    }
    // Defense in depth — the frontend already filters «наблюдатель»-group
    // members out of the assignee picker (PublicUser.canBeAssignee), but a
    // direct API call must be rejected here too, not just hidden in the UI.
    if (assignee.permissionGroupId) {
      const group = await this.permissionGroupsRepository.findOne({ where: { id: assignee.permissionGroupId } });
      if (group?.cannotBeAssignee) {
        throw new BadRequestException('Пользователь не может быть назначен исполнителем — роль наблюдателя');
      }
    }

    // The assignee write and its activity-log entry land atomically — a
    // crash between them used to leave the ticket reassigned with nothing in
    // the history explaining why. The remaining three steps are external
    // side effects (queue/pubsub/search), not DB writes a transaction can
    // help with, so they stay outside it and still run concurrently once the
    // reassignment itself is committed.
    await this.dataSource.transaction(async (manager) => {
      // Same fromValue-atomicity idiom as updateStatus() above, for
      // `assignedTo`.
      const locked = await manager
        .createQueryBuilder(TicketEntity, 'ticket')
        .setLock('pessimistic_write')
        .where('ticket.id = :id', { id })
        .getOne();
      if (!locked) {
        throw new NotFoundException('Ticket not found');
      }

      await manager.update(TicketEntity, { id }, { assignedTo: dto.assigneeId });
      await manager.insert(TicketActivityEntity, {
        ticketId: id,
        actorId: actor.sub,
        type: TicketActivityType.ASSIGNED,
        fromValue: locked.assignedTo ?? null,
        toValue: dto.assigneeId,
      });
    });
    await Promise.all([
      this.notificationsProducer.enqueue({
        type: NotificationType.ASSIGNMENT,
        userId: dto.assigneeId,
        ticketId: id,
      }),
      // Targeted, not broadcast — «Вам назначен тикет» must reach only
      // the new assignee, not every operator in the room.
      this.ticketEventsPublisher.publish({
        type: 'assigned',
        ticketId: id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        targetUserId: dto.assigneeId,
        status: toPublicTicketStatus(ticket.status),
        teamId: ticket.teamId,
        assignedTo: dto.assigneeId,
        createdBy: ticket.createdBy,
      }),
      this.searchIndexProducer.enqueueTicket(id),
    ]);

    const updated = await this.getTicketOrThrow(id);
    // The 'assigned' event above is a personal callout to the new assignee
    // only — the client (whose «Исполнитель» field just changed) and any
    // other operator with this ticket open still need the generic refresh.
    await this.broadcastTicketUpdated(updated, actor.sub);
    return toPublicTicket(updated);
  }

  async assignTeam(id: string, dto: AssignTeamDto, actor: JwtPayload): Promise<PublicTicket> {
    await this.getOwnedTicketOrThrow(id, actor);

    const team = await this.teamsRepository.findOne({ where: { id: dto.teamId } });
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    await this.dataSource.transaction(async (manager) => {
      // Same fromValue-atomicity idiom as updateStatus() above — the lock
      // must land before the previousTeam lookup below too (not just
      // before the UPDATE), since a concurrent assignTeam() landing
      // between the pre-transaction read above and here would otherwise
      // make `ticket.teamId` (and the name resolved from it) stale.
      const locked = await manager
        .createQueryBuilder(TicketEntity, 'ticket')
        .setLock('pessimistic_write')
        .where('ticket.id = :id', { id })
        .getOne();
      if (!locked) {
        throw new NotFoundException('Ticket not found');
      }
      // No dedicated activity type for this — team assignment is a
      // lighter-weight, less frequent edit than status/priority/assignee
      // changes.
      const previousTeam = locked.teamId
        ? await this.teamsRepository.findOne({ where: { id: locked.teamId } })
        : null;

      await manager.update(TicketEntity, { id }, { teamId: dto.teamId });
      await manager.insert(TicketActivityEntity, {
        ticketId: id,
        actorId: actor.sub,
        type: TicketActivityType.EDITED,
        field: 'team',
        fromValue: previousTeam?.name ?? null,
        toValue: team.name,
      });
    });
    await this.searchIndexProducer.enqueueTicket(id);

    const updated = await this.getTicketOrThrow(id);
    await this.broadcastTicketUpdated(updated, actor.sub);
    return toPublicTicket(updated);
  }

  // Staff-only editable, same tier as assignTeam above — a client picks a
  // category once at creation (see create()), staff can set/correct it
  // afterward (e.g. the client picked wrong, or logged the ticket
  // themselves without one). categoryId: null clears it back to "none".
  async updateCategory(id: string, dto: AssignCategoryDto, actor: JwtPayload): Promise<PublicTicket> {
    await this.getOwnedTicketOrThrow(id, actor);

    const nextCategory = dto.categoryId ? await this.ticketCategoriesRepository.findById(dto.categoryId) : null;
    if (dto.categoryId && !nextCategory) {
      throw new NotFoundException('Category not found');
    }

    await this.dataSource.transaction(async (manager) => {
      // Same fromValue-atomicity idiom as updateStatus()/assignTeam()
      // above.
      const locked = await manager
        .createQueryBuilder(TicketEntity, 'ticket')
        .setLock('pessimistic_write')
        .where('ticket.id = :id', { id })
        .getOne();
      if (!locked) {
        throw new NotFoundException('Ticket not found');
      }
      const previousCategory = locked.categoryId
        ? await this.ticketCategoriesRepository.findById(locked.categoryId)
        : null;

      await manager.update(TicketEntity, { id }, { categoryId: dto.categoryId });
      await manager.insert(TicketActivityEntity, {
        ticketId: id,
        actorId: actor.sub,
        type: TicketActivityType.EDITED,
        field: 'category',
        fromValue: previousCategory?.name ?? null,
        toValue: nextCategory?.name ?? null,
      });
    });
    await this.searchIndexProducer.enqueueTicket(id);

    const updated = await this.getTicketOrThrow(id);
    await this.broadcastTicketUpdated(updated, actor.sub);
    return toPublicTicket(updated);
  }

  // Moves every comment/attachment off the source ticket onto the target,
  // closes the source, and flags it via mergedIntoId so the frontend can
  // redirect visitors there. The row-moves + status flip happen in one
  // transaction — a reader must never observe comments that have already
  // moved while the source still looks "open" (or vice versa).
  async merge(id: string, dto: MergeTicketDto, actor: JwtPayload): Promise<PublicTicket> {
    if (id === dto.targetTicketId) {
      throw new BadRequestException('Cannot merge a ticket into itself');
    }
    // Both ends restriction-checked — merging INTO an invisible ticket would
    // otherwise let a restricted operator both discover it and dump content
    // into it.
    const source = await this.getOwnedTicketOrThrow(id, actor);
    const target = await this.getOwnedTicketOrThrow(dto.targetTicketId, actor);
    if (source.mergedIntoId) {
      throw new BadRequestException('This ticket has already been merged into another one');
    }
    if (target.mergedIntoId) {
      throw new BadRequestException('Cannot merge into a ticket that was itself merged elsewhere');
    }
    // "A closed status" for the source ticket — see
    // findClosedForSystemActions's own doc comment for how it picks one when
    // several isClosed=true rows exist.
    const closedStatus = await this.ticketStatusesRepository.findClosedForSystemActions();
    if (!closedStatus) {
      throw new BadRequestException('Нет доступного статуса «закрыт» — обратитесь к администратору.');
    }

    await this.dataSource.transaction(async (manager) => {
      // Locking re-check of the TARGET too, not just the source below — the
      // pre-check above (`if (target.mergedIntoId) throw`) reads it before
      // the transaction starts, so without this, two concurrent merges (this
      // one merging X→Y, another merging Y→Z) can both pass their own
      // pre-checks in the same window. FOR UPDATE blocks until any
      // in-flight merge that's already writing this row's mergedIntoId
      // (the other merge's own source-side update below, when this ticket
      // is ITS source) commits or rolls back, then re-reads the real state
      // — same TOCTOU protection as the source-side affected-rows check,
      // just via a row lock instead of a conditional UPDATE since nothing
      // here otherwise writes to the target ticket's own row.
      const lockedTarget = await manager
        .createQueryBuilder(TicketEntity, 'ticket')
        .setLock('pessimistic_write')
        .where('ticket.id = :targetId', { targetId: dto.targetTicketId })
        .getOne();
      if (!lockedTarget || lockedTarget.mergedIntoId) {
        throw new BadRequestException('Cannot merge into a ticket that was itself merged elsewhere');
      }

      // Re-check mergedIntoId as part of THIS update's WHERE, inside the
      // transaction — the pre-check above reads it before the transaction
      // starts, so without this a second concurrent merge() call on the same
      // source ticket can pass that same pre-check and both transactions
      // proceed, leaving comments/attachments split across two "merged into"
      // targets. affected === 0 means someone else merged it first between
      // the pre-check and here.
      const result = await manager.update(
        TicketEntity,
        { id, mergedIntoId: IsNull() },
        { mergedIntoId: dto.targetTicketId, statusId: closedStatus.id, closedAt: new Date() },
      );
      if (!result.affected) {
        throw new BadRequestException('This ticket has already been merged into another one');
      }
      await manager.update(CommentEntity, { ticketId: id }, { ticketId: dto.targetTicketId });
      await manager.update(AttachmentEntity, { ticketId: id }, { ticketId: dto.targetTicketId });

      // Tags carry a UNIQUE(ticket_id, tag_id) constraint — if the target
      // already has a tag the source also has, a plain repoint would
      // collide. Drop the source's row for those tags first, then repoint
      // whatever's left. Same conflict-safe shape used below for watchers,
      // and by ContactsService.merge() for TicketWatcherEntity when merging
      // contacts instead of tickets.
      await manager
        .createQueryBuilder()
        .delete()
        .from(TicketTagEntity)
        .where('ticket_id = :sourceId AND tag_id IN (SELECT tag_id FROM ticket_tags WHERE ticket_id = :targetId)', {
          sourceId: id,
          targetId: dto.targetTicketId,
        })
        .execute();
      await manager.update(TicketTagEntity, { ticketId: id }, { ticketId: dto.targetTicketId });

      // Custom field values carry a UNIQUE(ticket_id, field_id) constraint —
      // the target's existing value wins over the source's on conflict.
      await manager
        .createQueryBuilder()
        .delete()
        .from(TicketCustomFieldValueEntity)
        .where(
          'ticket_id = :sourceId AND field_id IN (SELECT field_id FROM ticket_custom_field_values WHERE ticket_id = :targetId)',
          { sourceId: id, targetId: dto.targetTicketId },
        )
        .execute();
      await manager.update(TicketCustomFieldValueEntity, { ticketId: id }, { ticketId: dto.targetTicketId });

      // Watchers carry a UNIQUE(ticket_id, user_id) constraint — someone
      // watching both tickets must not collide. Drop the source's row for
      // those watchers first, then repoint whatever's left, so anyone
      // watching ticket "1" keeps watching once its content lives on "2".
      await manager
        .createQueryBuilder()
        .delete()
        .from(TicketWatcherEntity)
        .where(
          'ticket_id = :sourceId AND user_id IN (SELECT user_id FROM ticket_watchers WHERE ticket_id = :targetId)',
          { sourceId: id, targetId: dto.targetTicketId },
        )
        .execute();
      await manager.update(TicketWatcherEntity, { ticketId: id }, { ticketId: dto.targetTicketId });

      // Mentions carry a UNIQUE(ticket_id, user_id) constraint, same
      // conflict-safe repoint as tags/watchers above. This is the source of
      // truth for the department-restriction bypass (staffCanSeeTicket) and
      // the "Упоминания" folder — without repointing it, a restricted
      // operator mentioned on the source ticket loses that access the
      // moment it merges away (the mention row stays behind on a ticket
      // that's now just a merged-away shell, hasMention() on the target
      // never finds it).
      await manager
        .createQueryBuilder()
        .delete()
        .from(TicketMentionEntity)
        .where(
          'ticket_id = :sourceId AND user_id IN (SELECT user_id FROM ticket_mentions WHERE ticket_id = :targetId)',
          { sourceId: id, targetId: dto.targetTicketId },
        )
        .execute();
      await manager.update(TicketMentionEntity, { ticketId: id }, { ticketId: dto.targetTicketId });
    });

    // Four independent side effects across the two tickets — none reads
    // another's result.
    await Promise.all([
      this.activityRepository.log({
        ticketId: id,
        actorId: actor.sub,
        type: TicketActivityType.MERGED_INTO,
        toValue: String(target.ticketNumber),
      }),
      this.activityRepository.log({
        ticketId: dto.targetTicketId,
        actorId: actor.sub,
        type: TicketActivityType.MERGED_FROM,
        fromValue: String(source.ticketNumber),
      }),
      this.searchIndexProducer.enqueueTicket(id),
      this.searchIndexProducer.enqueueTicket(dto.targetTicketId),
    ]);

    // Both ends changed — the source closed (and its client redirected via
    // mergedIntoId), the target gained the source's comments/attachments —
    // so both tickets' viewers (clients and any operator with either open)
    // need the live refresh, not just the source's. The two tickets are
    // unrelated reads/broadcasts, run concurrently rather than one pair at
    // a time.
    const [updated, updatedTarget] = await Promise.all([
      this.getTicketOrThrow(id),
      this.getTicketOrThrow(dto.targetTicketId),
    ]);
    await Promise.all([
      this.broadcastTicketUpdated(updated, actor.sub),
      this.broadcastTicketUpdated(updatedTarget, actor.sub),
    ]);
    return toPublicTicket(updated);
  }

  // "Удалить" — soft delete, moves the ticket to Trash. It vanishes from
  // every normal query (find/findOne exclude deletedAt-set rows by default)
  // without touching its comments/attachments/activity rows, so `restore`
  // brings back the exact same ticket rather than a reconstruction.
  async remove(id: string, actor: JwtPayload): Promise<void> {
    const ticket = await this.getOwnedTicketOrThrow(id, actor);
    await this.ticketsRepository.softDelete(id);
    await this.activityRepository.log({
      ticketId: id,
      actorId: actor.sub,
      type: TicketActivityType.DELETED,
    });
    await this.searchIndexProducer.enqueueTicket(id);
    // Every other ticket mutation ends with this — trashing was the one
    // exception, which left the client's still-open ticket page and any
    // operator's ticket list unaware the ticket just disappeared into
    // Trash until they manually refreshed.
    await this.broadcastTicketUpdated(ticket, actor.sub);
  }

  // Same department/own-tickets scoping as list() — without this, a
  // restricted operator could see every department's trashed tickets, not
  // just their own scope's.
  async listTrash(actor: JwtPayload): Promise<PublicTicket[]> {
    const tickets = await this.ticketsRepository.findTrash(this.staffRestrictions(actor));
    return tickets.map(toPublicTicket);
  }

  // getOwnedTicketOrThrow(..., includeDeleted=true) enforces the same
  // department/own-tickets scoping as every other mutation — without it, a
  // restricted operator could restore a ticket from any department via
  // Trash even though they can never see it once it's live again.
  async restore(id: string, actor: JwtPayload): Promise<PublicTicket> {
    const deleted = await this.getOwnedTicketOrThrow(id, actor, true);
    if (!deleted.deletedAt) {
      throw new NotFoundException('Ticket not found in trash');
    }
    await this.ticketsRepository.restore(id);
    await this.activityRepository.log({
      ticketId: id,
      actorId: actor.sub,
      type: TicketActivityType.RESTORED,
    });
    await this.searchIndexProducer.enqueueTicket(id);

    const restored = await this.getTicketOrThrow(id);
    // Same reasoning as remove() above — restoring is just as much a live
    // state change as any other mutation.
    await this.broadcastTicketUpdated(restored, actor.sub);
    return toPublicTicket(restored);
  }

  // Permanent delete — only ever from Trash, mirrors restore()'s own
  // getOwnedTicketOrThrow guard (same department/own-tickets scoping — a
  // restricted operator must not be able to permanently destroy a ticket
  // outside their scope just because it happens to be in Trash) so this
  // can't be pointed at a live ticket, or someone else's ticket, by id.
  // No activity-log entry: ticket_activities cascades away with the ticket
  // itself the instant this runs, so there'd be nothing left to log against.
  // Still enqueues a search-index job — the processor treats "ticket no
  // longer found" as "remove it from the index" (see SearchIndexProcessor),
  // which is what actually scrubs the now-nonexistent ticket out of search.
  async hardDelete(id: string, actor: JwtPayload): Promise<void> {
    const deleted = await this.getOwnedTicketOrThrow(id, actor, true);
    if (!deleted.deletedAt) {
      throw new NotFoundException('Ticket not found in trash');
    }
    // Read attachment keys before the DELETE — the ticket row cascades them
    // away from the DB immediately, so they must be captured first.
    const attachments = await this.dataSource
      .getRepository(AttachmentEntity)
      .find({ where: { ticketId: id }, select: ['fileUrl'] });
    await this.ticketsRepository.hardDelete(id);
    await this.searchIndexProducer.enqueueTicket(id);
    // Broadcast off the pre-delete snapshot — the row is already gone by
    // this point. Same reasoning as remove()/restore(): the client's own
    // still-open ticket page (and any operator's list) needs to learn this
    // live, not on the next manual refresh; the resulting ['ticket', id]
    // refetch just 404s, which the ticket detail page already has to
    // handle for any stale/bad id.
    await this.broadcastTicketUpdated(deleted, actor.sub);
    // Best-effort S3 cleanup, after the DB delete already succeeded — a
    // failed object delete must never block or roll back removing the
    // ticket itself (deleteObject() already logs its own failures).
    await Promise.allSettled(attachments.map((attachment) => this.s3Service.deleteObject(attachment.fileUrl)));
  }

  // "Следить" — self-managed. Not logged to ticket_activities (unlike
  // tags/merge/delete): it's a personal subscription, not a change to the
  // ticket itself, and would just be audit-log noise. getOwnedTicketOrThrow
  // (not the bare getTicketOrThrow) matters here now that clients can watch
  // too — without it, any authenticated client could watch/unwatch/query
  // watch-status on an arbitrary ticket UUID that isn't theirs.
  async watch(id: string, actor: JwtPayload): Promise<void> {
    await this.getOwnedTicketOrThrow(id, actor);
    await this.ticketsRepository.addWatcher(id, actor.sub);
  }

  async unwatch(id: string, actor: JwtPayload): Promise<void> {
    await this.getOwnedTicketOrThrow(id, actor);
    await this.ticketsRepository.removeWatcher(id, actor.sub);
  }

  async getWatchStatus(id: string, actor: JwtPayload): Promise<{ isWatching: boolean }> {
    await this.getOwnedTicketOrThrow(id, actor, true);
    const isWatching = await this.ticketsRepository.isWatching(id, actor.sub);
    return { isWatching };
  }

  // "Экспорт заявки" — a plain-text transcript (meta + description + the
  // full comment thread, internal notes included since this is an
  // operator/admin-only action) for saving/printing outside the app. No
  // export-template system (HelpDeskEddy's "Шаблоны экспорта") — one fixed,
  // readable format covers the actual need without the admin-configurable
  // template editor that implies.
  async exportTranscript(id: string, actor: JwtPayload): Promise<{ filename: string; content: string }> {
    const ticket = await this.getOwnedTicketOrThrow(id, actor, true);
    const comments = await this.commentsRepository.find({ where: { ticketId: id }, order: { createdAt: 'ASC' } });

    const authorIds = [...new Set(comments.map((c) => c.authorId))];
    const authors = authorIds.length > 0 ? await this.usersRepository.find({ where: { id: In(authorIds) } }) : [];
    const authorNameById = new Map(authors.map((u) => [u.id, u.fullName]));

    const lines: string[] = [
      `Тикет #${ticket.ticketNumber}: ${ticket.title}`,
      `Статус: ${ticket.status.name} | Приоритет: ${ticket.priority} | Тип: ${ticket.type.name}`,
      `Создано: ${ticket.createdAt.toISOString()}`,
      '',
      stripHtml(ticket.description),
      '',
      '--- Переписка ---',
      '',
    ];
    for (const comment of comments) {
      const author = authorNameById.get(comment.authorId) ?? 'Неизвестно';
      const tag = comment.isInternal ? ' [внутренний комментарий]' : '';
      lines.push(`[${comment.createdAt.toISOString()}] ${author}${tag}:`);
      lines.push(stripHtml(comment.body));
      lines.push('');
    }

    return { filename: `ticket-${ticket.ticketNumber}.txt`, content: lines.join('\n') };
  }

  // "Отправить статус" — an on-demand email to the client with the current
  // status, independent of the automatic per-event notifications (reply,
  // assignment, etc.) that already exist.
  async sendStatusEmail(id: string, actor: JwtPayload): Promise<void> {
    const ticket = await this.getOwnedTicketOrThrow(id, actor);
    await this.notificationsProducer.enqueue({
      type: NotificationType.STATUS_UPDATE,
      userId: ticket.createdBy,
      ticketId: id,
    });
    // Status ID, not the display name — see updateStatus()'s STATUS_CHANGED
    // logging for why.
    await this.activityRepository.log({
      ticketId: id,
      actorId: actor.sub,
      type: TicketActivityType.STATUS_EMAIL_SENT,
      toValue: ticket.status.id,
    });
  }

  // Called by SlaEscalationService's cron job — no acting user, so the
  // activity log entry gets actorId: null (see the comment on that column).
  // Bumps priority one step (capped at urgent), reindexes for search, and
  // notifies the assignee if there is one.
  async applySlaEscalation(
    id: string,
    activityType: TicketActivityType.SLA_RESPONSE_BREACHED | TicketActivityType.SLA_RESOLUTION_BREACHED,
  ): Promise<void> {
    const ticket = await this.getTicketOrThrow(id);
    const nextPriority = escalatePriority(ticket.priority);

    // Was two independent writes (a conditional priority UPDATE, then a
    // separate activity-log INSERT) — same class of bug already fixed
    // elsewhere in this file: a crash/lost connection between the two left
    // the priority bumped with no record of why, and the next SLA cron
    // tick's alreadyEscalated guard (which checks for exactly this activity
    // row) would find nothing and escalate the same ticket a second time.
    await this.dataSource.transaction(async (manager) => {
      if (nextPriority !== ticket.priority) {
        await manager.update(TicketEntity, { id }, { priority: nextPriority, slaPolicyId: ticket.slaPolicyId });
      }
      await manager.insert(TicketActivityEntity, {
        ticketId: id,
        actorId: null,
        type: activityType,
        fromValue: ticket.priority,
        toValue: nextPriority,
      });
    });
    await this.searchIndexProducer.enqueueTicket(id);
    await this.automationTriggerProducer.enqueue(AutomationTrigger.SLA_BREACHED, id);

    if (ticket.assignedTo) {
      await this.notificationsProducer.enqueue({
        type: NotificationType.SLA_BREACH,
        userId: ticket.assignedTo,
        ticketId: id,
      });
    }
    await this.broadcastTicketUpdated(ticket, null);
  }

  // Read-only snapshot for the automation engine's condition checks — no
  // actor, no RBAC scoping (the engine runs system-wide, not on behalf of a
  // specific user). Returns null rather than throwing so a rule referencing
  // a ticket that got deleted mid-run just aborts that run quietly.
  getSnapshotForAutomation(id: string): Promise<TicketEntity | null> {
    return this.ticketsRepository.findById(id);
  }

  // The following four applyAutomated* methods mirror applySlaEscalation's
  // shape (no actor, actorId: null in the activity log) but for the
  // Dispatcher's SET_STATUS/SET_PRIORITY/ASSIGN_TEAM/ASSIGN_USER actions.
  // Each re-fetches the ticket itself rather than trusting a snapshot the
  // caller might be holding, since several actions from the same rule run
  // in sequence and each should see the previous one's effect.
  //
  // Deliberately do NOT call automationTriggerProducer.enqueue() here (unlike
  // create/updateStatus/updatePriority/applySlaEscalation) — an automation-
  // driven change re-firing STATUS_CHANGED/PRIORITY_CHANGED would let two
  // rules ping-pong a ticket back and forth forever. Only human- or SLA-
  // cron-initiated changes re-enter the engine.

  async applyAutomatedStatus(id: string, statusId: string): Promise<void> {
    const ticket = await this.getTicketOrThrow(id);
    if (statusId === ticket.statusId) return;
    const targetStatus = await this.ticketStatusesRepository.findById(statusId);
    if (!targetStatus) return; // referenced status was deleted after the rule was saved — skip quietly, same as applyAutomatedTeam/applyAutomatedAssignee's deleted-target handling

    const closedAt = targetStatus.isClosed
      ? new Date()
      : ticket.status.isClosed
        ? null
        : (ticket.closedAt ?? null);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(TicketEntity, { id }, { statusId: targetStatus.id, closedAt });
      // Status ID, not the display name — see the same change in
      // updateStatus() above for why.
      await manager.insert(TicketActivityEntity, {
        ticketId: id,
        actorId: null,
        type: TicketActivityType.STATUS_CHANGED,
        fromValue: ticket.status.id,
        toValue: targetStatus.id,
      });
    });
    await this.searchIndexProducer.enqueueTicket(id);
    if (targetStatus.isClosed) {
      await this.csatService.ensureSurveyForTicket(id);
    }
    // broadcastTicketUpdated before the Telegram notify (not after, like it
    // used to be) — notifyTicketClosed is already made not to throw (see
    // its own comment), but keeping the real-time push first regardless
    // means it never depends on that guarantee holding.
    await this.broadcastTicketUpdated({ ...ticket, status: targetStatus }, null);
    if (targetStatus.isClosed) {
      await this.telegramCsatNotifyService.notifyTicketClosed(ticket);
    }
  }

  async applyAutomatedPriority(id: string, priority: TicketPriority): Promise<void> {
    const ticket = await this.getTicketOrThrow(id);
    if (priority === ticket.priority) return;

    const slaPolicy = await this.slaPoliciesRepository.findByPriority(priority);
    await this.dataSource.transaction(async (manager) => {
      await manager.update(TicketEntity, { id }, { priority, slaPolicyId: slaPolicy?.id ?? null });
      await manager.insert(TicketActivityEntity, {
        ticketId: id,
        actorId: null,
        type: TicketActivityType.PRIORITY_CHANGED,
        fromValue: ticket.priority,
        toValue: priority,
      });
    });
    await this.searchIndexProducer.enqueueTicket(id);
    await this.broadcastTicketUpdated(ticket, null);
  }

  async applyAutomatedTeam(id: string, teamId: string): Promise<void> {
    const ticket = await this.getTicketOrThrow(id);
    if (teamId === ticket.teamId) return;

    const team = await this.teamsRepository.findOne({ where: { id: teamId } });
    if (!team) return; // referenced team was deleted after the rule was saved — skip quietly
    const previousTeam = ticket.teamId
      ? await this.teamsRepository.findOne({ where: { id: ticket.teamId } })
      : null;

    await this.dataSource.transaction(async (manager) => {
      await manager.update(TicketEntity, { id }, { teamId });
      await manager.insert(TicketActivityEntity, {
        ticketId: id,
        actorId: null,
        type: TicketActivityType.EDITED,
        field: 'team',
        fromValue: previousTeam?.name ?? null,
        toValue: team.name,
      });
    });
    await this.searchIndexProducer.enqueueTicket(id);
    // Patched like applyAutomatedStatus above — `ticket` is the pre-update
    // snapshot fetched at the top of this method, still carrying the OLD
    // teamId. Broadcasting it as-is would push a stale team over the live
    // WS channel, leaving the sidebar/team-accordion showing this ticket
    // under its previous team until something else forces a refetch.
    await this.broadcastTicketUpdated({ ...ticket, teamId }, null);
  }

  async applyAutomatedAssignee(id: string, userId: string): Promise<void> {
    const ticket = await this.getTicketOrThrow(id);
    if (userId === ticket.assignedTo) return;

    const assignee = await this.usersRepository.findOne({ where: { id: userId } });
    if (!assignee || assignee.role === UserRole.CLIENT) return; // deleted/invalid target — skip quietly
    // Same «наблюдатель» invariant assign() enforces for humans — a rule
    // saved before its target joined a cannotBeAssignee group must not
    // become a bypass. Skip quietly, like the deleted-target case above.
    if (assignee.permissionGroupId) {
      const group = await this.permissionGroupsRepository.findOne({ where: { id: assignee.permissionGroupId } });
      if (group?.cannotBeAssignee) return;
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(TicketEntity, { id }, { assignedTo: userId });
      await manager.insert(TicketActivityEntity, {
        ticketId: id,
        actorId: null,
        type: TicketActivityType.ASSIGNED,
        fromValue: ticket.assignedTo ?? null,
        toValue: userId,
      });
    });
    await this.notificationsProducer.enqueue({
      type: NotificationType.ASSIGNMENT,
      userId,
      ticketId: id,
    });
    await this.searchIndexProducer.enqueueTicket(id);
    // Same fix as applyAutomatedTeam above — `ticket` still carries the OLD
    // assignedTo, patched here so the WS push shows the real new assignee.
    await this.broadcastTicketUpdated({ ...ticket, assignedTo: userId }, null);
  }

  // Posts a macro's body as a real public reply — the Dispatcher's
  // APPLY_MACRO action (AutomationRulesService.applyAction). Re-fetches the
  // ticket fresh like every other applyAutomated* method, so a rule that
  // assigns and THEN applies a macro in the same run sees the new assignee.
  //
  // comments.author_id is NOT NULL (unlike status/priority/team/assignee
  // changes, which log with actorId: null in ticket_activities — comments
  // have no such nullable slot). The assigned operator is used as the
  // author when there is one; on a still-unassigned ticket it falls back to
  // SYSTEM_USER_ID (see libs/types/system-accounts.ts) — a permanently
  // deactivated seeded row, never itself assigned to a ticket (that's
  // deliberate: assign()/applyAutomatedAssignee() can't target a
  // deactivated user anyway, and this method has no reason to touch
  // assignedTo). Placeholder resolution mirrors ChatPanel.tsx's
  // MACRO_PLACEHOLDERS exactly ({{client.fullName}}, {{operator.fullName}},
  // {{ticket.number}}) — {{operator.fullName}} resolves to the system
  // account's own name ("Автоответчик") in the unassigned case.
  async applyAutomatedReply(id: string, rawBody: string): Promise<void> {
    const ticket = await this.getTicketOrThrow(id);
    const authorId = ticket.assignedTo ?? SYSTEM_USER_ID;

    const [client, operator] = await Promise.all([
      this.usersRepository.findOne({ where: { id: ticket.createdBy } }),
      // withDeleted: the assignee branch is always active, but the
      // SYSTEM_USER_ID fallback is permanently soft-deleted — a plain
      // findOne would silently miss it and blank out {{operator.fullName}}.
      this.usersRepository.findOne({ where: { id: authorId }, withDeleted: true }),
    ]);
    const body = rawBody
      .split('{{client.fullName}}')
      .join(client?.fullName ?? '')
      .split('{{operator.fullName}}')
      .join(operator?.fullName ?? '')
      .split('{{ticket.number}}')
      .join(String(ticket.ticketNumber));

    const comment = this.commentsRepository.create({
      ticketId: id,
      authorId,
      body: sanitizeCommentBody(body),
      isInternal: false,
    });
    await this.commentsRepository.save(comment);

    // Same recipient rule as a human staff reply (chat.service.ts's
    // postMessage): the client gets notified, not the author.
    await this.notificationsProducer.enqueue({
      type: NotificationType.REPLY,
      userId: ticket.createdBy,
      ticketId: id,
    });
    // Watchers get the same REPLY notification a human reply would send
    // them (chat.service.ts's postMessage, the "Следить" block) — this
    // path used to skip them entirely, so a staff member (or client — they
    // can watch too) watching a ticket but not its assignee/creator
    // silently missed every automated macro reply. ticket.createdBy is
    // excluded since they were already notified above.
    const watcherIds = await this.ticketsRepository.findWatcherIds(id);
    await Promise.all(
      watcherIds
        .filter((userId) => userId !== ticket.createdBy)
        .map((userId) => this.notificationsProducer.enqueue({ type: NotificationType.REPLY, userId, ticketId: id })),
    );
    await this.ticketEventsPublisher.publish({
      type: 'reply',
      ticketId: id,
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      status: toPublicTicketStatus(ticket.status),
      teamId: ticket.teamId,
      assignedTo: ticket.assignedTo,
      createdBy: ticket.createdBy,
      // Same recipient as the notificationsProducer.enqueue above — without
      // this, the subscriber's targetUserId check falls through to
      // broadcastToOperators, so the client this reply is actually for never
      // gets a live toast/sound/push, while every operator gets a spurious one.
      targetUserId: ticket.createdBy,
    });
    await this.searchIndexProducer.enqueueTicket(id);
  }

  async getActivity(id: string, actor: JwtPayload): Promise<PublicTicketActivity[]> {
    await this.getOwnedTicketOrThrow(id, actor, true);
    const activities = await this.activityRepository.findByTicketId(id);
    // A MESSAGE_EDITED row for an internal staff note carries that note's
    // full before/after text (see ChatService.editMessage) — a client must
    // never see it here, same as the note itself is already invisible to
    // them in chat history.
    const visible = actor.role === UserRole.CLIENT ? activities.filter((a) => !a.internal) : activities;
    return visible.map(toPublicActivity);
  }

  // includeDeleted lets read-only callers (viewing a ticket's detail/
  // activity/attachments) still resolve a ticket sitting in Trash — every
  // mutating caller leaves this false, so a trashed ticket stays frozen
  // (can't be edited/replied to/etc.) until it's explicitly restored.
  private async getTicketOrThrow(id: string, includeDeleted = false) {
    const ticket = includeDeleted
      ? await this.ticketsRepository.findByIdIncludingDeleted(id)
      : await this.ticketsRepository.findById(id);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
  }

  // Everyone gets a 404 (not 403) for tickets outside their scope, so the
  // endpoint doesn't leak whether a given ticket id exists to someone
  // unauthorized. For staff, "their scope" means their permission group's
  // restrictions — the same rules the list enforces must hold for direct
  // by-id access (reads AND mutations), or a restricted operator could
  // reach any ticket by guessing/saving its UUID.
  private async getOwnedTicketOrThrow(id: string, actor: JwtPayload, includeDeleted = false) {
    const ticket = await this.getTicketOrThrow(id, includeDeleted);
    if (actor.role === UserRole.CLIENT) {
      if (ticket.createdBy !== actor.sub) {
        throw new NotFoundException('Ticket not found');
      }
      return ticket;
    }
    if (staffCanSeeTicket(actor, ticket)) {
      return ticket;
    }
    // A department-restricted operator still gets full access to a ticket
    // they were @mentioned on — see TicketMentionEntity's own comment. This
    // single check covers everything that funnels through assertAccess too
    // (tags/attachments/custom-fields), not just the direct callers below.
    if (await this.ticketsRepository.hasMention(id, actor.sub)) {
      return ticket;
    }
    throw new NotFoundException('Ticket not found');
  }

  // A generic "this ticket changed" push — status/priority/team/assignee/
  // detail edits all funnel through here so the ticket's own client AND any
  // operator with it open see the change live, without a manual refresh.
  // Two publishes, not one shared payload: the subscriber's routing is
  // exclusively one-or-the-other (targetUserId → that one user's room,
  // absent → broadcast to every operator — see
  // ticket-events-subscriber.service.ts), so reaching both audiences takes
  // two calls. `type` defaults to 'updated' (the vast majority of call
  // sites); notifyAttachmentAdded below reuses this with 'attachment'
  // instead of duplicating the dual-publish.
  private async broadcastTicketUpdated(
    ticket: {
      id: string;
      ticketNumber: number;
      title: string;
      status: TicketStatusEntity;
      createdBy: string;
      teamId?: string | null;
      assignedTo?: string | null;
    },
    actorId: string | null,
    type: TicketEventPayload['type'] = 'updated',
  ): Promise<void> {
    const base = {
      type,
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      status: toPublicTicketStatus(ticket.status),
      teamId: ticket.teamId,
      assignedTo: ticket.assignedTo,
      createdBy: ticket.createdBy,
      // null actorId means this call came from applySlaEscalation or one of
      // the applyAutomated* methods, not a human actor.
      automated: actorId === null,
    };
    // Independent Redis PUBLISH calls, different audiences — running them in
    // parallel instead of sequentially halves this helper's latency on
    // every single ticket mutation (11 call sites: update/status/priority/
    // assign/assignTeam/merge/SLA-escalation/automation actions).
    //
    // Every caller reaches this AFTER its own DB transaction has already
    // committed — this is purely a live-push side effect, not part of the
    // durable write. A Redis blip here must not turn an already-successful
    // mutation into a failed-looking request for the caller. Same
    // best-effort tradeoff as chat.service.ts's notification enqueue /
    // mention insert / automation trigger enqueue, which are likewise fired
    // after their own already-saved write.
    try {
      await Promise.all([
        this.ticketEventsPublisher.publish({ ...base, targetUserId: ticket.createdBy }),
        this.ticketEventsPublisher.publish({ ...base, excludeUserId: actorId ?? undefined }),
      ]);
    } catch (error) {
      this.logger.warn(
        `Failed to publish ticket-updated event for ticket ${ticket.id}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  // AttachmentsService calls this once a file upload is actually persisted
  // (not before) — the ticket's own client and any operator with it open
  // both have a live ['ticket', ticketId] query invalidation already wired
  // up (useTicketNotifications, both apps) that this piggybacks on for
  // free, no frontend changes needed. Fixes a real bug: without this, a
  // freshly-uploaded image attachment stayed invisible to the OTHER party
  // (rendered as an empty bubble — AttachmentImage has nothing to fetch)
  // until they manually reloaded the page. The existing 'reply' notify for
  // the message text itself fires too early to help — it's sent before the
  // (separate, sequential) file upload REST call even starts, so its
  // invalidation refetches an attachments list that doesn't have the row yet.
  async notifyAttachmentAdded(ticketId: string, actorId: string): Promise<void> {
    const ticket = await this.getTicketOrThrow(ticketId);
    await this.broadcastTicketUpdated(ticket, actorId, 'attachment');
  }

  private parseCursor(cursor: string) {
    try {
      return decodeTicketListCursor(cursor);
    } catch {
      throw new BadRequestException('Invalid pagination cursor');
    }
  }
}
