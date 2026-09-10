import { NotificationChannel, NotificationType } from '@veloxdesk/types';
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

@Entity('notifications')
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ type: 'enum', enum: NotificationType })
  type!: NotificationType;

  @Column({ type: 'enum', enum: NotificationChannel })
  channel!: NotificationChannel;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead!: boolean;

  // Nullable only because rows created before this column existed have
  // none — every new row (see NotificationJobPayload) always sets it.
  @Index()
  @Column({ name: 'ticket_id', type: 'uuid', nullable: true })
  ticketId?: string | null;

  @ManyToOne(() => TicketEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket?: TicketEntity | null;

  @CreateDateColumn({ name: 'sent_at', type: 'timestamptz' })
  sentAt!: Date;
}
