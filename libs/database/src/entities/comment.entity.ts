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

@Entity('comments')
export class CommentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId!: string;

  @ManyToOne(() => TicketEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket!: TicketEntity;

  @Index()
  @Column({ name: 'author_id', type: 'uuid' })
  authorId!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'author_id' })
  author!: UserEntity;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'is_internal', type: 'boolean', default: false })
  isInternal!: boolean;

  // Report queries filter/join on this by date range (see reports.repository.ts).
  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  // Set only when the author edits their message after posting — null means
  // never edited. Deliberately not @UpdateDateColumn: that would flip on ANY
  // entity save, not just a body edit.
  @Column({ name: 'edited_at', type: 'timestamptz', nullable: true })
  editedAt!: Date | null;
}
