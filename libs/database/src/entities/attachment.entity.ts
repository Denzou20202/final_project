import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CommentEntity } from './comment.entity.js';
import { TicketEntity } from './ticket.entity.js';
import { UserEntity } from './user.entity.js';

@Entity('attachments')
export class AttachmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId!: string;

  @ManyToOne(() => TicketEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket!: TicketEntity;

  // Nullable: attachments uploaded before this column existed have no known
  // uploader (no backfill possible) and render as a neutral card instead of
  // being aligned to a side. SET NULL (not CASCADE) on user deletion — the
  // file and its ticket history should survive the uploader's account being
  // removed.
  @Index()
  @Column({ name: 'uploader_id', type: 'uuid', nullable: true })
  uploaderId!: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploader_id' })
  uploader!: UserEntity | null;

  // Null while a file is staged client-side but not yet sent (upload
  // happens immediately on attach so the file is durably stored; linking to
  // a message happens only once the composer's Send is actually clicked —
  // see attachments.service.ts#upload). Also null for attachments created
  // before this column existed, and for ticket-creation-time uploads, which
  // stay ticket-scoped rather than tied to the synthetic first message.
  // CASCADE: an attachment only ever makes sense in the context of the
  // message it was sent with, once it has one.
  @Index()
  @Column({ name: 'comment_id', type: 'uuid', nullable: true })
  commentId!: string | null;

  @ManyToOne(() => CommentEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id' })
  comment!: CommentEntity | null;

  @Column({ name: 'file_url', type: 'varchar', length: 2048 })
  fileUrl!: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ name: 'file_size', type: 'int' })
  fileSize!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
