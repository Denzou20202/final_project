import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TicketEntity } from './ticket.entity.js';
import { UserEntity } from './user.entity.js';

// A durable record that `userId` was @mentioned in a comment on `ticketId` —
// unlike the fire-and-forget MENTION notification (no durable per-ticket
// record of its own), this is the source of truth for two things: (1) the
// department-restriction bypass — a staff actor who fails staffCanSeeTicket
// still gets full access to a ticket they were mentioned on, enforced
// independently in tickets.service.ts/csat.service.ts/chat.service.ts/
// search.service.ts; (2) the "Упоминания" sidebar folder (tickets.repository
// .ts's mentionedId filter, mirroring ticket_watchers' watcherId). Written
// once per (ticket, user) pair (see ChatService.postMessage's idempotent
// insert) and never removed even if a later edit strips the mention —
// access earned by a mention is meant to persist, same no-expiry semantics
// as Watching.
@Entity('ticket_mentions')
@Index(['ticketId', 'userId'], { unique: true })
export class TicketMentionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId!: string;

  @ManyToOne(() => TicketEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket!: TicketEntity;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @CreateDateColumn({ name: 'mentioned_at', type: 'timestamptz' })
  mentionedAt!: Date;
}
