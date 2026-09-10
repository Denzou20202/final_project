import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Admin-managed catalog of problem categories (products/software the client
// is having an issue with) — a client picks one on NewTicketPage, operators/
// admins see and can change it on the ticket. Flat, name-only, same shape as
// TagEntity/TeamEntity; a ticket's actual choice lives directly on
// TicketEntity.categoryId (a single FK, not a join table — a ticket has at
// most one category, unlike tags).
@Entity('ticket_categories')
export class TicketCategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  name!: string;

  // Auto-filled via DeepL on create/edit, editable before save — see
  // TicketStatusEntity.nameUk's comment.
  @Column({ name: 'name_uk', type: 'varchar', length: 100, nullable: true })
  nameUk?: string | null;

  @Column({ name: 'name_en', type: 'varchar', length: 100, nullable: true })
  nameEn?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
