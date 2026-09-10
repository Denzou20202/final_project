import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// The reusable catalog of tag names — a ticket's actual tags live in
// TicketTagEntity (many-to-many join). Global, not per-team, mirroring
// macros/custom fields.
@Entity('tags')
export class TagEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  name!: string;

  // Auto-filled via DeepL on rename, editable before save — see
  // TicketStatusEntity.nameUk's comment. Never populated on the free-typed
  // inline-create path (addToTicket) — only the dedicated rename flow.
  @Column({ name: 'name_uk', type: 'varchar', length: 100, nullable: true })
  nameUk?: string | null;

  @Column({ name: 'name_en', type: 'varchar', length: 100, nullable: true })
  nameEn?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
