import { TicketActivityType } from '@veloxdesk/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TicketEntity } from './ticket.entity.js';
import { UserEntity } from './user.entity.js';

@Entity('ticket_activities')
export class TicketActivityEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId!: string;

  @ManyToOne(() => TicketEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket!: TicketEntity;

  // Nullable: some events (e.g. automated SLA-breach transitions, later
  // sprints) are system-generated and have no acting user.
  @Index()
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId?: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'actor_id' })
  actor?: UserEntity;

  @Column({ type: 'enum', enum: TicketActivityType })
  type!: TicketActivityType;

  @Column({ name: 'from_value', type: 'text', nullable: true })
  fromValue?: string | null;

  @Column({ name: 'to_value', type: 'text', nullable: true })
  toValue?: string | null;

  // Discriminates which ticket attribute a generic EDITED entry touched
  // ('title' | 'description' | 'type' | 'team') — null for every other
  // activity type, where the type itself already says what happened.
  @Column({ name: 'field', type: 'varchar', length: 50, nullable: true })
  field?: string | null;

  // Set only on MESSAGE_EDITED rows for an internal staff note (see
  // ChatService.editMessage) — from/to_value there is the note's full
  // text, which TicketsService.getActivity must keep out of a client's
  // view the same way ChatService.getHistory already keeps the note
  // itself out of it. False (not null) for every other activity type.
  @Column({ type: 'boolean', default: false })
  internal!: boolean;

  // Report queries filter this table by date range (see reports.repository.ts).
  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
