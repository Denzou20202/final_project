import { TicketCustomFieldValueEntity } from '@veloxdesk/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class TicketCustomFieldValuesRepository {
  constructor(
    @InjectRepository(TicketCustomFieldValueEntity)
    private readonly repository: Repository<TicketCustomFieldValueEntity>,
  ) {}

  findByTicket(ticketId: string): Promise<TicketCustomFieldValueEntity[]> {
    return this.repository.find({ where: { ticketId } });
  }

  // Was a non-atomic find-then-write (findOne, then update or save
  // depending on the result) — two concurrent calls for the same
  // ticket+field (e.g. an automation rule's SET_CUSTOM_FIELD action firing
  // right as an operator saves the same field from the ticket panel) could
  // both see no existing row and both attempt an INSERT, with the loser
  // hitting the table's own unique(ticket_id, field_id) index as a raw,
  // unhandled violation. A real ON CONFLICT upsert closes that window —
  // same pattern already used by knowledge-theme/employee-statuses'
  // settings-row upserts.
  async upsert(ticketId: string, fieldId: string, value: string): Promise<void> {
    await this.repository.upsert({ ticketId, fieldId, value }, ['ticketId', 'fieldId']);
  }

  async delete(ticketId: string, fieldId: string): Promise<void> {
    await this.repository.delete({ ticketId, fieldId });
  }
}
