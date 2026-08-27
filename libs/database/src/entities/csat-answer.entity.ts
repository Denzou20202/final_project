import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CsatQuestionEntity } from './csat-question.entity.js';
import { CsatSurveyEntity } from './csat-survey.entity.js';
import { TicketEntity } from './ticket.entity.js';

// One row per question per submitted survey. `ticketId` is denormalized
// (also reachable via surveyId -> csat_surveys.ticket_id) purely so the
// CSAT report's SQL can filter/group by team/assignee with a single join
// straight to `tickets`, matching the style of TicketActivityEntity/
// ReportsRepository rather than hopping through csat_surveys every time.
// `questionText` is a snapshot taken at submission time — if an admin later
// renames or disables the question, past reports keep reading what the
// client actually saw, the same convention EmployeeStatusHistoryEntity uses
// for status names.
@Entity('csat_answers')
export class CsatAnswerEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'survey_id', type: 'uuid' })
  surveyId!: string;

  @ManyToOne(() => CsatSurveyEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'survey_id' })
  survey!: CsatSurveyEntity;

  @Index()
  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId!: string;

  @ManyToOne(() => TicketEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket!: TicketEntity;

  @Column({ name: 'question_id', type: 'uuid', nullable: true })
  questionId?: string | null;

  @ManyToOne(() => CsatQuestionEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'question_id' })
  question?: CsatQuestionEntity | null;

  @Column({ name: 'question_text', type: 'varchar', length: 255 })
  questionText!: string;

  @Column({ type: 'int' })
  score!: number;

  // Indexed — the CSAT report (analytics-service's reports.repository.ts)
  // filters this table by date range.
  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
