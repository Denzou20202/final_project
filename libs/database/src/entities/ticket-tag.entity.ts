import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TagEntity } from './tag.entity.js';
import { TicketEntity } from './ticket.entity.js';

@Entity('ticket_tags')
@Index(['ticketId', 'tagId'], { unique: true })
export class TicketTagEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId!: string;

  @ManyToOne(() => TicketEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket!: TicketEntity;

  @Column({ name: 'tag_id', type: 'uuid' })
  tagId!: string;

  @ManyToOne(() => TagEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tag_id' })
  tag!: TagEntity;
}
