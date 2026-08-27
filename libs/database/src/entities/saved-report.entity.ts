import { ReportGroupBy } from '@veloxdesk/types';
import type { ReportFilters } from '@veloxdesk/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity.js';

// A saved report-constructor configuration (group-by + filters) — re-run
// against live data every time it's opened, never a stored point-in-time
// result, since ticket data keeps changing. Global like macros/custom
// fields: any operator/admin can open, edit, or delete any saved report,
// not just the one who created it.
@Entity('saved_reports')
export class SavedReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'group_by', type: 'enum', enum: ReportGroupBy })
  groupBy!: ReportGroupBy;

  @Column({ type: 'jsonb' })
  filters!: ReportFilters;

  // Which output columns are visible — a display preference persisted with
  // the report (it's a shared resource, not a per-browser setting like the
  // ticket list's column store). Null/absent = show every column.
  @Column({ type: 'jsonb', nullable: true })
  columns?: string[] | null;

  @Index()
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator?: UserEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
