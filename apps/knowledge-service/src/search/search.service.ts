import { JwtPayload, staffCanSeeTicket } from '@veloxdesk/common';
import { TicketEntity, TicketMentionEntity } from '@veloxdesk/database';
import { TicketPriority } from '@veloxdesk/types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ElasticsearchService, TICKETS_INDEX } from '../elasticsearch/elasticsearch.service.js';

interface IndexedTicket {
  title: string;
  description: string;
  // ticket_statuses row id — see SearchIndexProcessor's own comment for why
  // just the id is denormalized here, not the full status object.
  status: string;
  priority: TicketPriority;
  createdBy: string;
  assignedTo: string | null;
  createdAt: string;
}

export interface TicketSearchResult {
  id: string;
  title: string;
  // ticket_statuses row id — resolve name/color via useTicketStatuses().
  status: string;
  priority: TicketPriority;
  createdAt: string;
  score: number | null;
  highlight: Record<string, string[]>;
}

const TICKET_SEARCH_FIELDS = ['title', 'description'];

@Injectable()
export class SearchService {
  constructor(
    private readonly elasticsearch: ElasticsearchService,
    @InjectRepository(TicketEntity)
    private readonly ticketsRepository: Repository<TicketEntity>,
    @InjectRepository(TicketMentionEntity)
    private readonly mentionsRepository: Repository<TicketMentionEntity>,
  ) {}

  async searchTickets(actor: JwtPayload, q: string, limit?: number): Promise<TicketSearchResult[]> {
    const hits = await this.elasticsearch.search<IndexedTicket>(TICKETS_INDEX, q, TICKET_SEARCH_FIELDS, limit);
    const visible = await this.filterHitsForActor(actor, hits);

    return visible.map((hit) => ({
      id: hit.id,
      title: hit.source.title,
      status: hit.source.status,
      priority: hit.source.priority,
      createdAt: hit.source.createdAt,
      score: hit.score,
      highlight: hit.highlight ?? {},
    }));
  }

  // Permission-group scoping for restricted staff — otherwise full-text
  // search would surface titles/snippets of tickets the list hides. The
  // index doesn't carry teamId (and may lag behind reassignment anyway),
  // so the authoritative ownership fields are re-read from Postgres for
  // the hit ids; a hit whose row is gone (deleted since indexing) is
  // dropped along the way. Unrestricted staff skip the extra query.
  private async filterHitsForActor<T extends { id: string }>(actor: JwtPayload, hits: T[]): Promise<T[]> {
    if (hits.length === 0 || (!actor.restrictToDepartments && !actor.restrictToOwnTickets)) {
      return hits;
    }
    const hitIds = hits.map((hit) => hit.id);
    // Same department-restriction bypass as tickets.service.ts's
    // getOwnedTicketOrThrow — see TicketMentionEntity's own comment. One
    // batch query for the whole hit set, not a per-hit awaited call.
    const [rows, mentionRows] = await Promise.all([
      this.ticketsRepository.find({
        select: ['id', 'createdBy', 'assignedTo', 'teamId'],
        where: { id: In(hitIds) },
      }),
      this.mentionsRepository.find({
        select: ['ticketId'],
        where: { ticketId: In(hitIds), userId: actor.sub },
      }),
    ]);
    const rowById = new Map(rows.map((row) => [row.id, row]));
    const mentionedTicketIds = new Set(mentionRows.map((r) => r.ticketId));
    return hits.filter((hit) => {
      const row = rowById.get(hit.id);
      if (!row) return false;
      return staffCanSeeTicket(actor, row) || mentionedTicketIds.has(hit.id);
    });
  }
}
