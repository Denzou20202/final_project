import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TicketEntity } from './ticket.entity.js';

// One row per ticket, ever — created (via CsatService.ensureSurveyForTicket)
// the first time a ticket becomes CLOSED, never again for that same ticket
// even across reopen/reclose. `submittedAt` null means the client hasn't
// answered yet (ChatPanel shows the "оцените" prompt); once set, the score
// is locked forever — no re-submission endpoint exists.
@Entity('csat_surveys')
export class CsatSurveyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId!: string;

  @ManyToOne(() => TicketEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket!: TicketEntity;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
