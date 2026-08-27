import { CommentEntity, TicketEntity } from '@veloxdesk/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';

@Injectable()
export class SlaEscalationRepository {
  constructor(
    @InjectRepository(TicketEntity)
    private readonly ticketsRepository: Repository<TicketEntity>,
    @InjectRepository(CommentEntity)
    private readonly commentsRepository: Repository<CommentEntity>,
  ) {}

  // Tickets still open (ticket_statuses.tracks_sla = true — replaces the
  // old hardcoded [OPEN, PENDING] pair, generalizing to any admin-defined
  // status that should keep counting toward SLA breaches) whose
  // first-response deadline has passed. The "already responded" check
  // happens separately per-candidate (a plain WHERE NOT EXISTS here would
  // work too, but this stays readable and the candidate set is small at
  // this scale — 10-50 operators per prompt.md).
  findResponseBreachCandidates(): Promise<TicketEntity[]> {
    return this.ticketsRepository
      .createQueryBuilder('ticket')
      .innerJoinAndSelect('ticket.slaPolicy', 'policy')
      .innerJoin('ticket.status', 'status')
      .where('status.tracksSla = true')
      .andWhere(`ticket.created_at + (policy.response_time_min || ' minutes')::interval < now()`)
      .getMany();
  }

  findResolutionBreachCandidates(): Promise<TicketEntity[]> {
    return this.ticketsRepository
      .createQueryBuilder('ticket')
      .innerJoinAndSelect('ticket.slaPolicy', 'policy')
      .innerJoin('ticket.status', 'status')
      .where('status.tracksSla = true')
      .andWhere(`ticket.created_at + (policy.resolution_time_min || ' minutes')::interval < now()`)
      .getMany();
  }

  // Internal notes don't count as a response to the client, and a comment
  // from the client themselves obviously isn't a reply to them either.
  async hasOperatorResponse(ticketId: string, createdBy: string): Promise<boolean> {
    const count = await this.commentsRepository.count({
      where: { ticketId, isInternal: false, authorId: Not(createdBy) },
    });
    return count > 0;
  }
}
