import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Admin-defined catalog a staff member manually picks from (e.g. «На обеде»,
// «Совещание») — replaces a fixed online/away/offline enum. «Онлайн» (no
// row picked) and «Неактивен» (auto, see EmployeeStatusService in
// chat-service) are synthetic, not catalog rows, same way online/offline
// itself is already computed rather than stored (see PresenceService).
@Entity('employee_statuses')
export class EmployeeStatusEntity {
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

  // Hex, e.g. "#F59E0B" — validated at the DTO layer.
  @Column({ type: 'varchar', length: 7 })
  color!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
