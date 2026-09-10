import { SlaPolicyEntity } from '@veloxdesk/database';
import { TicketPriority } from '@veloxdesk/types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class SlaPoliciesRepository {
  constructor(
    @InjectRepository(SlaPolicyEntity)
    private readonly repository: Repository<SlaPolicyEntity>,
  ) {}

  create(data: {
    name: string;
    responseTimeMin: number;
    resolutionTimeMin: number;
    priority: TicketPriority;
  }): Promise<SlaPolicyEntity> {
    return this.repository.save(this.repository.create(data));
  }

  findAll(): Promise<SlaPolicyEntity[]> {
    return this.repository.find({ order: { priority: 'ASC' } });
  }

  findById(id: string): Promise<SlaPolicyEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  // At most one policy per priority tier — the SLA a ticket gets is
  // determined purely by its current priority.
  findByPriority(priority: TicketPriority): Promise<SlaPolicyEntity | null> {
    return this.repository.findOne({ where: { priority } });
  }

  async update(
    id: string,
    data: Partial<{ name: string; responseTimeMin: number; resolutionTimeMin: number; priority: TicketPriority }>,
  ): Promise<void> {
    await this.repository.update({ id }, data);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
