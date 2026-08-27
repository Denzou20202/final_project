import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TicketEntity } from './ticket.entity.js';
import { UserEntity } from './user.entity.js';

// "Следить" (Watch/Follow) — a staff member who isn't the assignee can still
// opt into new-reply notifications for a ticket they care about. Separate
// from `assignedTo` (single owner) — any number of watchers, self-managed.
@Entity('ticket_watchers')
@Index(['ticketId', 'userId'], { unique: true })
export class TicketWatcherEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId!: string;

  @ManyToOne(() => TicketEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket!: TicketEntity;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
