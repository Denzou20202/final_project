import { TicketActivityEntity } from '@veloxdesk/database';
import { TicketActivityType } from '@veloxdesk/types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class TicketActivityRepository {
  constructor(
    @InjectRepository(TicketActivityEntity)
    private readonly repository: Repository<TicketActivityEntity>,
  ) {}

  log(data: {
    ticketId: string;
    actorId: string | null;
    type: TicketActivityType;
    fromValue?: string | null;
    toValue?: string | null;
    field?: string | null;
    internal?: boolean;
  }): Promise<TicketActivityEntity> {
    const activity = this.repository.create(data);
    return this.repository.save(activity);
  }

  findByTicketId(ticketId: string): Promise<TicketActivityEntity[]> {
    return this.repository.find({ where: { ticketId }, order: { createdAt: 'ASC' } });
  }

  async existsOfType(ticketId: string, type: TicketActivityType): Promise<boolean> {
    const count = await this.repository.count({ where: { ticketId, type } });
    return count > 0;
  }
}
