import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Admin-managed catalog of allowed company names — a client picks one on the
// mandatory onboarding form (OnboardingModal) and staff can change it on
// their client card (EditUserModal). Flat, name-only, same shape as
// TicketCategoryEntity — but UserEntity.company stays a plain string (no FK
// column here): unlike a ticket's category, this value is entered once at
// onboarding and rarely revisited, and every existing reader (report
// groupBy, the ticket's «Клиент» panel, contacts CSV export) already treats
// it as free text, so there's nothing to gain from a relational column and
// a lot of unrelated call sites to touch for no behavioral difference.
@Entity('companies')
export class CompanyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
