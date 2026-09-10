import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Admin-managed catalog of CSAT survey questions — free text (no i18n, same
// as custom-field labels), shown to the client in `sortOrder` after a ticket
// closes. `isEnabled` lets an admin retire a question without deleting it
// (deleting would orphan CsatAnswerEntity.questionId via ON DELETE SET NULL,
// which is fine too, but disabling keeps the option to bring it back).
@Entity('csat_questions')
export class CsatQuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  text!: string;

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled!: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
