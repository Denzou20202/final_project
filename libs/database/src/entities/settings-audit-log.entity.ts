import { SettingsAuditEventType, SettingsAuditModule } from '@veloxdesk/types';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserEntity } from './user.entity.js';

// «Глобальный аудит настроек» — distinct from ticket_activities (that one
// logs per-ticket actions). Covers the 4 admin-configuration modules named
// in the roadmap item: SLA policies, permission groups, custom fields,
// automation rules.
//
// actorId is a live FK (mirrors ticket_activities.actor_id — actors are
// users, which are soft-deleted, never hard-deleted, so this is safe).
// entityId deliberately has NO foreign key — unlike tickets, every one of
// the 4 target entities CAN be hard-deleted, and an audit trail must
// survive that (a live FK would either cascade away the very row proving
// the deletion happened, or block the deletion outright once it has any
// audit history). entityLabel is a denormalized name snapshot for the same
// reason (a later rename, or the delete itself, must never blank out what
// the log is talking about).
@Entity('settings_audit_log')
export class SettingsAuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId?: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'actor_id' })
  actor?: UserEntity;

  @Index()
  @Column({ type: 'enum', enum: SettingsAuditModule })
  module!: SettingsAuditModule;

  // Indexed — the settings-audit report (analytics-service) filters on this.
  @Index()
  @Column({ name: 'event_type', type: 'enum', enum: SettingsAuditEventType })
  eventType!: SettingsAuditEventType;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId?: string | null;

  @Column({ name: 'entity_label', type: 'varchar', length: 255 })
  entityLabel!: string;

  // Whatever fields the create/update request actually set — not a full
  // before/after diff (the 4 services don't currently fetch-then-compare),
  // just "what was submitted", which is already the useful part of "кто и
  // когда менял". Null for DELETE events.
  @Column({ type: 'jsonb', nullable: true })
  changes?: Record<string, unknown> | null;

  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
