import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('teams')
export class TeamEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  // Auto-filled via DeepL on create/edit, editable before save — see
  // TicketStatusEntity.nameUk's comment.
  @Column({ name: 'name_uk', type: 'varchar', length: 255, nullable: true })
  nameUk?: string | null;

  @Column({ name: 'name_en', type: 'varchar', length: 255, nullable: true })
  nameEn?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
