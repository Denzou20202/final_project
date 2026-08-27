import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// A canned-response snippet an operator can insert into a reply instead of
// retyping the same answer every time. Global (not per-team/per-user) —
// admin-managed, everyone reads the same list.
@Entity('macros')
export class MacroEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  // Auto-filled via DeepL on create/edit, editable before save — see
  // TicketStatusEntity.nameUk's comment. Only the title translates; `body`
  // (the actual canned-response text) stays admin-language-only by design.
  @Column({ name: 'title_uk', type: 'varchar', length: 255, nullable: true })
  titleUk?: string | null;

  @Column({ name: 'title_en', type: 'varchar', length: 255, nullable: true })
  titleEn?: string | null;

  @Column({ type: 'text' })
  body!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
