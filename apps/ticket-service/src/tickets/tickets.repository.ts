import { TicketEntity, TicketMentionEntity, TicketWatcherEntity } from '@veloxdesk/database';
import { SortOrder, TicketPriority, TicketSortField } from '@veloxdesk/types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository, SelectQueryBuilder } from 'typeorm';
import { TicketStatusesRepository } from '../ticket-statuses/ticket-statuses.repository.js';
import { TicketTypesRepository } from '../ticket-types/ticket-types.repository.js';
import { TicketListCursor } from './ticket-list-cursor.js';

export interface TicketFilters {
  statusId?: string;
  priority?: TicketPriority;
  assignedTo?: string;
  createdBy?: string;
  teamId?: string;
  tagId?: string;
  watcherId?: string;
  mentionedId?: string;
  search?: string;
  createdFrom?: Date;
  createdTo?: Date;
  // Mandatory, permission-group-derived narrowing — distinct from the
  // user-chosen `teamId`/`assignedTo`/`createdBy` filters above, which stay
  // optional and don't restrict anyone. An empty array means "no department
  // grants at all" and must match zero tickets, not be treated as unset.
  restrictDepartmentIds?: string[];
  restrictToUserId?: string;
}

// Alphabetical order on the raw enum string would sort priority as
// high/low/medium/urgent — meaningless to a user expecting urgent tickets
// at the top. This CASE expression gives ORDER BY (and the matching
// keyset WHERE clause) the actual severity rank instead. Written against
// the literal quoted "ticket" alias — the query builder always aliases this
// entity as "ticket" — rather than relying on TypeORM's alias.property
// rewriting inside a compound raw expression. Status sorting no longer
// needs an equivalent CASE — ticket_statuses.sort_order (an admin-editable
// live column) already IS the rank, reached via the "status" join alias
// findPage always attaches.
const PRIORITY_RANK_SQL =
  `CASE "ticket"."priority" WHEN 'low' THEN 1 WHEN 'medium' THEN 2 WHEN 'high' THEN 3 WHEN 'urgent' THEN 4 END`;

export const PRIORITY_RANK: Record<TicketPriority, number> = {
  [TicketPriority.LOW]: 1,
  [TicketPriority.MEDIUM]: 2,
  [TicketPriority.HIGH]: 3,
  [TicketPriority.URGENT]: 4,
};

// `_` and `%` are ILIKE wildcards, not literal characters — without this a
// search for "Тест_" also matches "Тест3_юзер" (the "_" swallows the "3").
// Postgres' default LIKE escape character is backslash.
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

const SORT_EXPR: Record<TicketSortField, string> = {
  [TicketSortField.TICKET_NUMBER]: 'ticket.ticketNumber',
  [TicketSortField.TITLE]: 'ticket.title',
  [TicketSortField.STATUS]: 'status.sortOrder',
  [TicketSortField.PRIORITY]: PRIORITY_RANK_SQL,
  [TicketSortField.CREATED_AT]: 'ticket.createdAt',
};

// Mirrors SORT_EXPR — the value the service reads off the last row on a
// page to build the next cursor, in the same terms the WHERE clause above
// compares against (rank numbers for priority/status, not the raw value).
// Requires `ticket.status` to be loaded (findPage always joins it).
export function ticketSortValue(ticket: TicketEntity, field: TicketSortField): string | number {
  switch (field) {
    case TicketSortField.TICKET_NUMBER:
      return ticket.ticketNumber;
    case TicketSortField.TITLE:
      return ticket.title;
    case TicketSortField.STATUS:
      return ticket.status.sortOrder;
    case TicketSortField.PRIORITY:
      return PRIORITY_RANK[ticket.priority];
    case TicketSortField.CREATED_AT:
      return ticket.createdAt.toISOString();
  }
}

@Injectable()
export class TicketsRepository {
  constructor(
    @InjectRepository(TicketEntity)
    private readonly repository: Repository<TicketEntity>,
    @InjectRepository(TicketWatcherEntity)
    private readonly watchersRepository: Repository<TicketWatcherEntity>,
    @InjectRepository(TicketMentionEntity)
    private readonly mentionsRepository: Repository<TicketMentionEntity>,
    private readonly ticketStatusesRepository: TicketStatusesRepository,
    private readonly ticketTypesRepository: TicketTypesRepository,
  ) {}

  async create(data: {
    title: string;
    description: string;
    priority: TicketPriority;
    typeId?: string;
    createdBy: string;
    createdOnBehalfBy?: string | null;
    slaPolicyId?: string | null;
    categoryId?: string | null;
  }): Promise<TicketEntity> {
    const defaultStatus = await this.ticketStatusesRepository.findDefault();
    if (!defaultStatus) {
      throw new Error('No default ticket status configured — the ticket_statuses catalog must always have exactly one.');
    }
    let typeId = data.typeId;
    if (!typeId) {
      const defaultType = await this.ticketTypesRepository.findDefault();
      if (!defaultType) {
        throw new Error('No default ticket type configured — the ticket_types catalog must always have exactly one.');
      }
      typeId = defaultType.id;
    }
    const ticket = this.repository.create({ ...data, typeId, statusId: defaultStatus.id });
    return this.repository.save(ticket);
  }

  findById(id: string): Promise<TicketEntity | null> {
    return this.repository.findOne({ where: { id }, relations: ['status', 'type'] });
  }

  // For read-only lookups that must still resolve a trashed ticket (viewing
  // its detail/activity/attachments while it sits in Trash) — mutations
  // keep using findById above, so a trashed ticket stays frozen until it's
  // explicitly restored.
  findByIdIncludingDeleted(id: string): Promise<TicketEntity | null> {
    return this.repository.findOne({ where: { id }, relations: ['status', 'type'], withDeleted: true });
  }

  // Backs the "merge" UI's target-ticket lookup — an operator types the
  // short human-facing number, not a uuid.
  findByNumber(ticketNumber: number): Promise<TicketEntity | null> {
    return this.repository.findOne({ where: { ticketNumber }, relations: ['status', 'type'] });
  }

  // Mandatory permission-group restrictions (see tickets.service.ts) — kept
  // separate from the optional user-chosen filters above so it's obvious at
  // a glance which conditions the caller picked versus which ones they
  // can't opt out of.
  private applyRestrictions(qb: SelectQueryBuilder<TicketEntity>, filters: TicketFilters): void {
    // A merged-away ticket is a dead end everywhere except its own detail
    // page (needed so TicketDetailPage can still read mergedIntoId and
    // redirect) — excluded here, not per-caller, so nothing new can forget
    // it. findByNumber() deliberately does NOT go through this method — it
    // still needs to find a merged ticket, both for the redirect and for
    // MergeTicketModal's "already merged" check on a would-be target.
    qb.andWhere('ticket.mergedIntoId IS NULL');
    if (filters.restrictDepartmentIds) {
      if (filters.restrictDepartmentIds.length === 0) {
        // No department grants at all — matches nothing, not "unrestricted".
        qb.andWhere('FALSE');
      } else {
        qb.andWhere('ticket.teamId IN (:...restrictDepartmentIds)', {
          restrictDepartmentIds: filters.restrictDepartmentIds,
        });
      }
    }
    if (filters.restrictToUserId) {
      qb.andWhere('(ticket.assignedTo = :restrictToUserId OR ticket.createdBy = :restrictToUserId)', {
        restrictToUserId: filters.restrictToUserId,
      });
    }
  }

  // Quick header search over the three things an operator actually knows
  // about a ticket at a glance: its number (substring, with or without a
  // leading #, same "contains" behavior as everything else here — typing
  // "15" should surface #15, #150, and #215 alike, not only an exact #15),
  // the client's name, or words from the subject. Deliberately NOT the
  // full-text message search (/search does that) — this filters the live
  // list in place. LEFT JOIN, not inner: a ticket must still match by
  // number/title even if its author row is somehow gone.
  private applySearch(qb: SelectQueryBuilder<TicketEntity>, search: string | undefined): void {
    if (!search?.trim()) return;

    qb.leftJoin('users', 'author', 'author.id = ticket.created_by');

    // Only trimmed for the "is this actually a ticket number" check below —
    // the pattern itself keeps the string exactly as typed (see
    // escapeLikePattern) so a literal trailing/leading space narrows the
    // match instead of silently being discarded.
    const trimmed = search.trim();
    const escapedTerm = escapeLikePattern(search);
    const digits = /^#?\d+$/.test(trimmed) ? trimmed.replace(/^#/, '') : undefined;
    if (digits !== undefined) {
      qb.andWhere(
        "(ticket.title ILIKE :searchTerm OR author.full_name ILIKE :searchTerm OR CAST(ticket.ticketNumber AS TEXT) ILIKE :searchNumber)",
        { searchTerm: `%${escapedTerm}%`, searchNumber: `%${digits}%` },
      );
    } else {
      qb.andWhere('(ticket.title ILIKE :searchTerm OR author.full_name ILIKE :searchTerm)', {
        searchTerm: `%${escapedTerm}%`,
      });
    }
  }

  // Fetches `limit + 1` rows so the caller can tell whether a next page
  // exists without a separate COUNT(*) query.
  findPage(
    limit: number,
    filters: TicketFilters,
    sort: { field: TicketSortField; order: SortOrder },
    after?: TicketListCursor,
  ): Promise<TicketEntity[]> {
    const expr = SORT_EXPR[sort.field];
    const direction = sort.order === SortOrder.ASC ? 'ASC' : 'DESC';

    const qb = this.repository
      .createQueryBuilder('ticket')
      // Always joined — toPublicTicket() needs the full status/type objects
      // on every returned row, not just when sorting by status.
      .leftJoinAndSelect('ticket.status', 'status')
      .leftJoinAndSelect('ticket.type', 'type')
      .orderBy(expr, direction)
      .addOrderBy('ticket.id', direction)
      .take(limit + 1);

    if (filters.statusId) {
      qb.andWhere('ticket.statusId = :statusId', { statusId: filters.statusId });
    }
    if (filters.priority) {
      qb.andWhere('ticket.priority = :priority', { priority: filters.priority });
    }
    if (filters.assignedTo === 'unassigned') {
      qb.andWhere('ticket.assignedTo IS NULL');
    } else if (filters.assignedTo === 'assigned') {
      qb.andWhere('ticket.assignedTo IS NOT NULL');
    } else if (filters.assignedTo) {
      qb.andWhere('ticket.assignedTo = :assignedTo', { assignedTo: filters.assignedTo });
    }
    if (filters.createdBy) {
      qb.andWhere('ticket.createdBy = :createdBy', { createdBy: filters.createdBy });
    }
    if (filters.teamId) {
      qb.andWhere('ticket.teamId = :teamId', { teamId: filters.teamId });
    }
    if (filters.tagId) {
      qb.innerJoin('ticket_tags', 'tt', 'tt.ticket_id = ticket.id AND tt.tag_id = :tagId', { tagId: filters.tagId });
    }
    if (filters.watcherId) {
      qb.innerJoin('ticket_watchers', 'tw', 'tw.ticket_id = ticket.id AND tw.user_id = :watcherId', {
        watcherId: filters.watcherId,
      });
    }
    if (filters.mentionedId) {
      qb.innerJoin('ticket_mentions', 'tm', 'tm.ticket_id = ticket.id AND tm.user_id = :mentionedId', {
        mentionedId: filters.mentionedId,
      });
    }
    if (filters.createdFrom) {
      qb.andWhere('ticket.createdAt >= :createdFrom', { createdFrom: filters.createdFrom });
    }
    if (filters.createdTo) {
      qb.andWhere('ticket.createdAt <= :createdTo', { createdTo: filters.createdTo });
    }
    this.applyRestrictions(qb, filters);
    this.applySearch(qb, filters.search);
    if (after) {
      const op = sort.order === SortOrder.ASC ? '>' : '<';
      qb.andWhere(`(${expr}, ticket.id) ${op} (:sortValue, :cursorId)`, {
        sortValue: after.sortValue,
        cursorId: after.id,
      });
    }

    return qb.getMany();
  }

  // Every status id currently in the catalog, in display order — backs the
  // zero-init step of the getCounts* family below so a status with zero
  // matching tickets still shows up as 0 rather than being absent from the
  // response (the sidebar/report-filter UIs render one row per catalog
  // entry, not per row this query happens to return).
  private async allStatusIds(): Promise<string[]> {
    const statuses = await this.ticketStatusesRepository.findAll();
    return statuses.map((s) => s.id);
  }

  private async zeroCounts(): Promise<Record<string, number>> {
    return Object.fromEntries((await this.allStatusIds()).map((id) => [id, 0]));
  }

  // Grouped by status regardless of any status filter (that's the whole
  // point — feeds the sidebar's per-folder badges and the list header's
  // accurate total in one round trip), scoped by whatever else the caller
  // is allowed/choosing to filter by.
  async getCounts(filters: Omit<TicketFilters, 'statusId'>): Promise<Record<string, number>> {
    const qb = this.repository
      .createQueryBuilder('ticket')
      .select('ticket.statusId', 'statusId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('ticket.statusId');

    if (filters.priority) {
      qb.andWhere('ticket.priority = :priority', { priority: filters.priority });
    }
    if (filters.assignedTo === 'unassigned') {
      qb.andWhere('ticket.assignedTo IS NULL');
    } else if (filters.assignedTo === 'assigned') {
      qb.andWhere('ticket.assignedTo IS NOT NULL');
    } else if (filters.assignedTo) {
      qb.andWhere('ticket.assignedTo = :assignedTo', { assignedTo: filters.assignedTo });
    }
    if (filters.createdBy) {
      qb.andWhere('ticket.createdBy = :createdBy', { createdBy: filters.createdBy });
    }
    if (filters.teamId) {
      qb.andWhere('ticket.teamId = :teamId', { teamId: filters.teamId });
    }
    if (filters.tagId) {
      qb.innerJoin('ticket_tags', 'tt', 'tt.ticket_id = ticket.id AND tt.tag_id = :tagId', { tagId: filters.tagId });
    }
    if (filters.watcherId) {
      qb.innerJoin('ticket_watchers', 'tw', 'tw.ticket_id = ticket.id AND tw.user_id = :watcherId', {
        watcherId: filters.watcherId,
      });
    }
    if (filters.mentionedId) {
      qb.innerJoin('ticket_mentions', 'tm', 'tm.ticket_id = ticket.id AND tm.user_id = :mentionedId', {
        mentionedId: filters.mentionedId,
      });
    }
    this.applyRestrictions(qb, filters);
    this.applySearch(qb, filters.search);

    const [rows, byStatus] = await Promise.all([
      qb.getRawMany<{ statusId: string; count: string }>(),
      this.zeroCounts(),
    ]);
    for (const row of rows) {
      byStatus[row.statusId] = Number(row.count);
    }
    return byStatus;
  }

  // Backs Sidebar's per-team status accordion — one GROUP BY query instead
  // of the N individual getCounts(teamId) calls the sidebar used to make
  // (one per rendered team), which fanned out into enough parallel requests
  // on a busy page load to trip nginx's rate limit (see
  // docs/superpowers/specs — the attachment-thumbnails-stuck-loading bug).
  async getCountsByTeam(
    restrictions: Pick<TicketFilters, 'restrictDepartmentIds' | 'restrictToUserId'>,
  ): Promise<Record<string, Record<string, number>>> {
    const qb = this.repository
      .createQueryBuilder('ticket')
      .select('ticket.teamId', 'teamId')
      .addSelect('ticket.statusId', 'statusId')
      .addSelect('COUNT(*)', 'count')
      .where('ticket.teamId IS NOT NULL')
      .groupBy('ticket.teamId')
      .addGroupBy('ticket.statusId');
    this.applyRestrictions(qb, restrictions);

    const [rows, zero] = await Promise.all([
      qb.getRawMany<{ teamId: string; statusId: string; count: string }>(),
      this.zeroCounts(),
    ]);
    const byTeam: Record<string, Record<string, number>> = {};
    for (const row of rows) {
      byTeam[row.teamId] ??= { ...zero };
      byTeam[row.teamId][row.statusId] = Number(row.count);
    }
    return byTeam;
  }

  // Feeds the per-team accordion's «Неприсвоенные» row — same semantics as
  // the top-level unassigned filter (assignedTo IS NULL, the DEFAULT status
  // only — a closed-but-unassigned ticket, e.g. auto-closed by an
  // automation rule or SLA escalation, has no business showing up as "needs
  // an assignee"). "The default status" replaces the old hardcoded OPEN
  // check so this keeps working if an admin ever changes which status new
  // tickets start in.
  async getUnassignedCountsByTeam(
    restrictions: Pick<TicketFilters, 'restrictDepartmentIds' | 'restrictToUserId'>,
  ): Promise<Record<string, number>> {
    const defaultStatus = await this.ticketStatusesRepository.findDefault();
    if (!defaultStatus) return {};

    const qb = this.repository
      .createQueryBuilder('ticket')
      .select('ticket.teamId', 'teamId')
      .addSelect('COUNT(*)', 'count')
      .where('ticket.teamId IS NOT NULL')
      .andWhere('ticket.assignedTo IS NULL')
      .andWhere('ticket.statusId = :defaultStatusId', { defaultStatusId: defaultStatus.id })
      .groupBy('ticket.teamId');
    this.applyRestrictions(qb, restrictions);

    const rows = await qb.getRawMany<{ teamId: string; count: string }>();
    return Object.fromEntries(rows.map((row) => [row.teamId, Number(row.count)]));
  }

  // Feeds the per-team accordion's operator drill-down — one row per
  // (team, assignee, status). Ticket assignment isn't constrained to match
  // the ticket's own team, so this groups by both explicitly rather than
  // assuming an operator's team membership implies their assigned tickets
  // all carry that same teamId.
  async getCountsByTeamAndAssignee(
    restrictions: Pick<TicketFilters, 'restrictDepartmentIds' | 'restrictToUserId'>,
  ): Promise<Record<string, Record<string, Record<string, number>>>> {
    const qb = this.repository
      .createQueryBuilder('ticket')
      .select('ticket.teamId', 'teamId')
      .addSelect('ticket.assignedTo', 'assignedTo')
      .addSelect('ticket.statusId', 'statusId')
      .addSelect('COUNT(*)', 'count')
      .where('ticket.teamId IS NOT NULL')
      .andWhere('ticket.assignedTo IS NOT NULL')
      .groupBy('ticket.teamId')
      .addGroupBy('ticket.assignedTo')
      .addGroupBy('ticket.statusId');
    this.applyRestrictions(qb, restrictions);

    const [rows, zero] = await Promise.all([
      qb.getRawMany<{ teamId: string; assignedTo: string; statusId: string; count: string }>(),
      this.zeroCounts(),
    ]);
    const byTeam: Record<string, Record<string, Record<string, number>>> = {};
    for (const row of rows) {
      byTeam[row.teamId] ??= {};
      byTeam[row.teamId][row.assignedTo] ??= { ...zero };
      byTeam[row.teamId][row.assignedTo][row.statusId] = Number(row.count);
    }
    return byTeam;
  }

  // Same batching rationale as getCountsByTeam, for the sidebar's per-tag
  // nav items.
  async getCountsByTag(
    restrictions: Pick<TicketFilters, 'restrictDepartmentIds' | 'restrictToUserId'>,
  ): Promise<Record<string, Record<string, number>>> {
    const qb = this.repository
      .createQueryBuilder('ticket')
      .innerJoin('ticket_tags', 'tt', 'tt.ticket_id = ticket.id')
      .select('tt.tag_id', 'tagId')
      .addSelect('ticket.statusId', 'statusId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('tt.tag_id')
      .addGroupBy('ticket.statusId');
    this.applyRestrictions(qb, restrictions);

    const [rows, zero] = await Promise.all([
      qb.getRawMany<{ tagId: string; statusId: string; count: string }>(),
      this.zeroCounts(),
    ]);
    const byTag: Record<string, Record<string, number>> = {};
    for (const row of rows) {
      byTag[row.tagId] ??= { ...zero };
      byTag[row.tagId][row.statusId] = Number(row.count);
    }
    return byTag;
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete({ id });
  }

  async restore(id: string): Promise<void> {
    await this.repository.restore({ id });
  }

  // Permanent — a real SQL DELETE, not another soft-delete. Every inbound FK
  // to tickets.id (comments/attachments/activities/custom-field values/tags/
  // watchers/notifications/CSAT) is ON DELETE CASCADE except the self-FK
  // merged_into_id (ON DELETE SET NULL) — see the AddTicketTypeMergeTagsWatchers
  // /InitSchema/AddCsat migrations — so Postgres cascades every child row on
  // its own; no manual cleanup needed here for referential integrity. S3
  // attachment objects are NOT cleaned up (no delete method exists in
  // s3.service.ts at all) — a known, flagged gap, not handled by this method.
  async hardDelete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  // find()/findOne() exclude soft-deleted rows by default — withDeleted
  // plus an explicit deletedAt-not-null filter is what actually scopes this
  // to "only what's in the trash" instead of "everything, deleted or not".
  // Query-builder (not repository.find()) so applyRestrictions can layer the
  // same department/own-tickets scoping every other list query enforces —
  // otherwise a restricted operator would see every department's trash.
  findTrash(restrictions: Pick<TicketFilters, 'restrictDepartmentIds' | 'restrictToUserId'>): Promise<TicketEntity[]> {
    const qb = this.repository
      .createQueryBuilder('ticket')
      .withDeleted()
      .leftJoinAndSelect('ticket.status', 'status')
      .leftJoinAndSelect('ticket.type', 'type')
      .where('ticket.deletedAt IS NOT NULL')
      .orderBy('ticket.deletedAt', 'DESC');
    this.applyRestrictions(qb, restrictions);
    return qb.getMany();
  }

  findDeletedById(id: string): Promise<TicketEntity | null> {
    return this.repository.findOne({
      withDeleted: true,
      where: { id, deletedAt: Not(IsNull()) },
      relations: ['status', 'type'],
    });
  }

  async addWatcher(ticketId: string, userId: string): Promise<void> {
    await this.watchersRepository
      .createQueryBuilder()
      .insert()
      .into(TicketWatcherEntity)
      .values({ ticketId, userId })
      .orIgnore()
      .execute();
  }

  async removeWatcher(ticketId: string, userId: string): Promise<void> {
    await this.watchersRepository.delete({ ticketId, userId });
  }

  async isWatching(ticketId: string, userId: string): Promise<boolean> {
    const count = await this.watchersRepository.count({ where: { ticketId, userId } });
    return count > 0;
  }

  // Backs applyAutomatedReply's watcher-notification loop — mirrors
  // chat-service's own `watchersRepository.find({ where: { ticketId } })`
  // (chat.service.ts's postMessage), just returning ids only since that's
  // all the caller needs here.
  async findWatcherIds(ticketId: string): Promise<string[]> {
    const rows = await this.watchersRepository.find({ where: { ticketId } });
    return rows.map((row) => row.userId);
  }

  // Same pattern as isWatching above — used by TicketsService.
  // getOwnedTicketOrThrow as the department-restriction bypass: a staff
  // actor who fails staffCanSeeTicket still gets full access to a ticket
  // they were @mentioned on. See TicketMentionEntity's own comment.
  async hasMention(ticketId: string, userId: string): Promise<boolean> {
    const count = await this.mentionsRepository.count({ where: { ticketId, userId } });
    return count > 0;
  }
}
