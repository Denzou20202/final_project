import { TicketChannel, TicketPriority } from '@veloxdesk/types';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SlaPolicyEntity } from './sla-policy.entity.js';
import { TeamEntity } from './team.entity.js';
import { TicketCategoryEntity } from './ticket-category.entity.js';
import { TicketStatusEntity } from './ticket-status.entity.js';
import { TicketTypeEntity } from './ticket-type.entity.js';
import { UserEntity } from './user.entity.js';

@Entity('tickets')
export class TicketEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // A short, human-friendly sequential number (#1042) for display — the
  // real key everywhere else (FKs, URLs) stays the uuid `id`. Assigned by a
  // Postgres sequence via DEFAULT nextval(...), never set from app code.
  @Index({ unique: true })
  @Column({ name: 'ticket_number', type: 'int' })
  ticketNumber!: number;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  // Admin-managed catalog pick (see TicketStatusEntity) — replaces the old
  // fixed 4-value enum column. Kept as a plain scalar column PLUS a relation
  // on the same physical column, same dual pattern as categoryId/category
  // below, so callers that only need the id (filters, GROUP BY) don't have
  // to join, while callers rendering a badge/label can load the relation.
  @Index()
  @Column({ name: 'status_id', type: 'uuid' })
  statusId!: string;

  @ManyToOne(() => TicketStatusEntity)
  @JoinColumn({ name: 'status_id' })
  status!: TicketStatusEntity;

  // Indexed — findPage/getCounts (tickets.repository.ts) both filter on
  // this whenever a priority filter is active, same as status right above.
  @Index()
  @Column({ type: 'enum', enum: TicketPriority, default: TicketPriority.MEDIUM })
  priority!: TicketPriority;

  // Admin-managed catalog pick (see TicketTypeEntity) — replaces the old
  // fixed 4-value enum column, same dual scalar+relation shape as statusId/
  // status above.
  @Index()
  @Column({ name: 'type_id', type: 'uuid' })
  typeId!: string;

  @ManyToOne(() => TicketTypeEntity)
  @JoinColumn({ name: 'type_id' })
  type!: TicketTypeEntity;

  // How this ticket entered the system — see TicketChannel. 'portal' covers
  // both the web UI and any authenticated-actor API create; email/telegram
  // are set explicitly by their respective ingestion modules.
  @Index()
  @Column({ type: 'enum', enum: TicketChannel, default: TicketChannel.PORTAL })
  channel!: TicketChannel;

  @Index()
  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'created_by' })
  creator!: UserEntity;

  // Set when an operator/admin created this ticket on behalf of the client
  // named in `created_by` (e.g. logging a phone call) — null for tickets the
  // client submitted themselves.
  @Index()
  @Column({ name: 'created_on_behalf_by', type: 'uuid', nullable: true })
  createdOnBehalfBy?: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'created_on_behalf_by' })
  onBehalfOfStaff?: UserEntity;

  @Index()
  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedTo?: string;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'assigned_to' })
  assignee?: UserEntity;

  @Index()
  @Column({ name: 'team_id', type: 'uuid', nullable: true })
  teamId?: string;

  @ManyToOne(() => TeamEntity, { nullable: true })
  @JoinColumn({ name: 'team_id' })
  team?: TeamEntity;

  // Admin-managed catalog pick (see TicketCategoryEntity) — the client's
  // "problem category" chosen at creation, or set/changed later by staff the
  // same way team/priority are. Optional: a ticket with no category set is a
  // normal, unremarkable state, not an error.
  @Index()
  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId?: string | null;

  @ManyToOne(() => TicketCategoryEntity, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  category?: TicketCategoryEntity | null;

  @Index()
  @Column({ name: 'sla_policy_id', type: 'uuid', nullable: true })
  slaPolicyId?: string | null;

  @ManyToOne(() => SlaPolicyEntity, { nullable: true })
  @JoinColumn({ name: 'sla_policy_id' })
  slaPolicy?: SlaPolicyEntity;

  // Default sort field for the ticket list — indexed so that common case
  // isn't a sequential scan + sort once the table has real volume.
  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt?: Date | null;

  // The Message-ID of the inbound email that created this ticket, when the
  // ticket originated from email. Later replies are matched against this via
  // their In-Reply-To/References headers and appended as comments instead of
  // spawning a duplicate ticket. Unique when present — Postgres allows
  // multiple NULLs under a unique index, so tickets created via the web/API
  // (no email thread) are unaffected.
  @Index({ unique: true })
  @Column({ name: 'external_thread_id', type: 'text', nullable: true })
  externalThreadId?: string | null;

  // Set when this ticket was merged into another one (see TicketsService.merge)
  // — the source ticket stays in the database (comments/attachments already
  // moved off it) but is closed and flagged so the UI can redirect visitors
  // to the surviving ticket instead.
  @Index()
  @Column({ name: 'merged_into_id', type: 'uuid', nullable: true })
  mergedIntoId?: string | null;

  @ManyToOne(() => TicketEntity, { nullable: true })
  @JoinColumn({ name: 'merged_into_id' })
  mergedInto?: TicketEntity;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
