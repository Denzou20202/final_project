import { CommentEntity, TicketEntity } from '@veloxdesk/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';

import { TicketActivityType } from '@veloxdesk/types';

@Injectable()
export class SlaEscalationRepository {
  constructor(
    @InjectRepository(TicketEntity)
    private readonly ticketsRepository: Repository<TicketEntity>,
    @InjectRepository(CommentEntity)
    private readonly commentsRepository: Repository<CommentEntity>,
  ) {}

  findResponseBreachCandidates(limit = 100): Promise<TicketEntity[]> {
    return this.ticketsRepository
      .createQueryBuilder('ticket')
      .innerJoinAndSelect('ticket.slaPolicy', 'policy')
      .innerJoin('ticket.status', 'status')
      .where('status.tracksSla = true')
      .andWhere(
        `ticket.created_at + ((policy.response_time_min + COALESCE(ticket.paused_duration_min, 0)) || ' minutes')::interval < now()`,
      )
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM ticket_activities a WHERE a.ticket_id = ticket.id AND a.type = :responseBreachType)`,
        { responseBreachType: TicketActivityType.SLA_RESPONSE_BREACHED },
      )
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM comments c WHERE c.ticket_id = ticket.id AND c.is_internal = false AND c.author_id <> ticket.created_by)`,
      )
      .limit(limit)
      .getMany();
  }

  findResolutionBreachCandidates(limit = 100): Promise<TicketEntity[]> {
    return this.ticketsRepository
      .createQueryBuilder('ticket')
      .innerJoinAndSelect('ticket.slaPolicy', 'policy')
      .innerJoin('ticket.status', 'status')
      .where('status.tracksSla = true')
      .andWhere(
        `ticket.created_at + ((policy.resolution_time_min + COALESCE(ticket.paused_duration_min, 0)) || ' minutes')::interval < now()`,
      )
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM ticket_activities a WHERE a.ticket_id = ticket.id AND a.type = :resolutionBreachType)`,
        { resolutionBreachType: TicketActivityType.SLA_RESOLUTION_BREACHED },
      )
      .limit(limit)
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
