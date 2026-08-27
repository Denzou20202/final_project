import { TicketType } from '@veloxdesk/types';
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Admin-managed catalog replacing the old fixed 4-value TicketType enum —
// tickets.type_id is a plain FK into this table (see TicketEntity.type), not
// an enum column, so admins can add/rename/recolor/delete their own ticket
// types. The 4 original types are seeded here as regular rows (see the
// AddTicketTypes migration) with `key` set — same shape as TicketStatusEntity
// (see that entity's comment). `weight` folds in what used to be the separate
// ticket_type_weights table: that table assumed exactly 4 immutable rows
// keyed by the enum, which breaks the moment types become admin-creatable —
// keeping the weight as a column here means a new type gets one for free
// (default 1, same neutral seed the old table used) and a deleted type just
// takes its weight with it.
@Entity('ticket_types')
export class TicketTypeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Set ONLY on the 4 seeded rows — lets frontends keep translating those via
  // the existing `ticketType.<key>` i18n keys. Always null for admin-created
  // custom types, which just show `name` as-is in every locale.
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  key?: TicketType | null;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  // Auto-filled via DeepL when an admin creates/edits a custom type, editable
  // before save, left NULL if translation fails/is unconfigured — frontends
  // fall back to `name` (see pickLocalized) whenever these are null/empty.
  @Column({ name: 'name_uk', type: 'varchar', length: 255, nullable: true })
  nameUk?: string | null;

  @Column({ name: 'name_en', type: 'varchar', length: 255, nullable: true })
  nameEn?: string | null;

  // Hex, e.g. "#D64545" — validated at the DTO layer.
  @Column({ type: 'varchar', length: 7 })
  color!: string;

  // Exactly one row has this true (enforced in TicketTypesService, plus a
  // DB-level partial unique index as a backstop) — the default type for new
  // tickets created without an explicit typeId.
  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  // Report builder's "KPI as a weighted sum by ticket type" column (see
  // ReportsRepository.groupedReport) — an admin can say e.g. an incident is
  // "worth" more than a question. 1 is neutral (every type counts equally).
  @Column({ type: 'int', default: 1 })
  weight!: number;

  // Display order everywhere: dropdowns/report filters. New types append at
  // the end.
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
