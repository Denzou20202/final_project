import { TicketStatus } from '@veloxdesk/types';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Admin-managed catalog replacing the old fixed 4-value TicketStatus enum —
// tickets.status_id is a plain FK into this table (see TicketEntity.status),
// not an enum column, so admins can add/rename/recolor/delete their own
// statuses. The 4 original statuses are seeded here as regular rows (see the
// AddTicketStatuses migration) with `key` set — nothing about this entity
// protects them beyond the same generic guards every row gets (see
// TicketStatusesService.remove): can't delete a status while any ticket
// still has it, can't delete the current `isDefault` row.
@Entity('ticket_statuses')
export class TicketStatusEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Set ONLY on the 4 seeded rows — lets frontends/telegram-bot keep
  // translating those via the existing `ticketStatus.<key>` i18n keys.
  // Always null for admin-created custom statuses, which just show `name`
  // as-is in every locale.
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  key?: TicketStatus | null;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  // Auto-filled via DeepL when an admin creates/edits a custom status (never
  // set for the 4 seeded rows above — those already translate via `key`),
  // editable before save, left NULL if translation fails/is unconfigured —
  // frontends fall back to `name` (see pickLocalized) whenever these are
  // null/empty. Same pair on custom_field_definitions/macros/
  // knowledge_articles/teams/tags/ticket_categories/employee_statuses.
  @Column({ name: 'name_uk', type: 'varchar', length: 255, nullable: true })
  nameUk?: string | null;

  @Column({ name: 'name_en', type: 'varchar', length: 255, nullable: true })
  nameEn?: string | null;

  // Hex, e.g. "#C2683F" — validated at the DTO layer.
  @Column({ type: 'varchar', length: 7 })
  color!: string;

  // Exactly one row has this true (enforced in TicketStatusesService, plus
  // a DB-level partial unique index as a backstop) — the default status for
  // new tickets and the anchor for the "Неприсвоенные" folder.
  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  // Zero or more rows may have this true — triggers closedAt, the CSAT
  // survey, chat message-locking, and the close-requires-assignee guard.
  @Column({ name: 'is_closed', type: 'boolean', default: false })
  isClosed!: boolean;

  // Whether tickets in this status still count toward SLA breach tracking.
  @Column({ name: 'tracks_sla', type: 'boolean', default: true })
  tracksSla!: boolean;

  // Display order everywhere: badges/dropdowns/sidebar folders/report
  // columns. New statuses append at the end.
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
