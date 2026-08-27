import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CustomFieldDefinitionEntity } from './custom-field-definition.entity.js';
import { TicketEntity } from './ticket.entity.js';

// One row per (ticket, field) pair that has actually been set — tickets
// with no value for a given field simply have no row, rather than a row
// with a null value. `value` is always stored as text; the field's
// `fieldType` on the definition tells the frontend how to parse/render it.
@Entity('ticket_custom_field_values')
@Index(['ticketId', 'fieldId'], { unique: true })
export class TicketCustomFieldValueEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId!: string;

  @ManyToOne(() => TicketEntity)
  @JoinColumn({ name: 'ticket_id' })
  ticket!: TicketEntity;

  @Column({ name: 'field_id', type: 'uuid' })
  fieldId!: string;

  @ManyToOne(() => CustomFieldDefinitionEntity)
  @JoinColumn({ name: 'field_id' })
  field!: CustomFieldDefinitionEntity;

  @Column({ type: 'text' })
  value!: string;
}
