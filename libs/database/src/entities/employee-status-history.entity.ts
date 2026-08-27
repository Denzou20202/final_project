import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserEntity } from './user.entity.js';

// Denormalized name/color snapshot (not a FK to EmployeeStatusEntity) —
// same reasoning as TicketActivityEntity's fromValue/toValue: a later
// rename or deletion of the catalog entry must never rewrite history.
// Only meaningful transitions are logged here (a manual pick, or an
// automatic idle/return-from-idle toggle) — raw socket connect/disconnect
// blips are not, that would flood this table with noise nobody asked for.
@Entity('employee_status_history')
export class EmployeeStatusHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ name: 'status_name', type: 'text' })
  statusName!: string;

  @Column({ name: 'status_color', type: 'varchar', length: 7, nullable: true })
  statusColor?: string | null;

  // True for the auto idle-timeout transition and its auto return; false
  // for a status the employee picked themselves.
  @Column({ type: 'boolean', default: false })
  automatic!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
